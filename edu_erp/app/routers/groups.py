from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func, or_, select
from app.models.branches import Branch
from app.models.courses import Course
from app.models.enums import EnrollmentStatus, GroupStatus
from app.models.groups import Group
from app.models.lessons import GroupSchedule
from app.models.rooms import Room
from app.models.employees import Employee
from app.models.students import Enrollment, Student
from app.models.teacher_profiles import TeacherProfile
from app.schemes.common import Message
from app.schemes.groups import (GroupCreate, GroupResponse, GroupUpdate, ScheduleCreate, ScheduleResponse,
                                ScheduleUpdate)
from app.schemes.students import StudentResponse
from app.services.accounts import employee_has_role
from app.services.scheduling import schedule_conflict
from app.utils.access import ensure_branch, is_teacher_only, scoped
from app.utils.checked import check_ident, safe_commit
from app.utils.deps import MyDb
from app.utils.pagination import Page, Pagination, paginate
from app.utils.permissions import AuthUser, ManagerUser
from app.utils.roles import TEACHER

router = APIRouter(prefix="/groups", tags=["Groups"])
_LIVE = [GroupStatus.PLANNED, GroupStatus.ACTIVE]


async def _check_teacher(db, teacher_id: int, exclude_group_id: int | None = None):
    emp = await db.get(Employee, teacher_id)
    if emp is None or not emp.is_active:
        raise HTTPException(400, "O'qituvchi topilmadi yoki faol emas")
    if not await employee_has_role(db, teacher_id, TEACHER):
        raise HTTPException(400, "Xodimda 'teacher' roli yo'q")
    profile = await db.get(TeacherProfile, teacher_id)
    if profile and profile.max_groups:
        stmt = select(func.count(Group.id)).where(Group.teacher_id == teacher_id, Group.status.in_(_LIVE))
        if exclude_group_id:
            stmt = stmt.where(Group.id != exclude_group_id)
        if (await db.scalar(stmt) or 0) >= profile.max_groups:
            raise HTTPException(409, "O'qituvchi maksimal guruhlar soniga yetgan")


async def _check_room(db, room_id: int, branch_id: int, max_students: int):
    room = await check_ident(db, Room, room_id, "Xona topilmadi")
    if not room.is_active:
        raise HTTPException(400, "Xona faol emas")
    if room.branch_id != branch_id:
        raise HTTPException(400, "Xona boshqa filialga tegishli")
    if max_students > room.capacity:
        raise HTTPException(400, f"max_students ({max_students}) xona sig'imidan ({room.capacity}) katta")


def _check_dates(start, end):
    if start and end and end < start:
        raise HTTPException(400, "end_date start_date dan oldin bo'lmasligi kerak")


async def _load(db, user, group_id: int) -> Group:
    g = await check_ident(db, Group, group_id, "Guruh topilmadi")
    ensure_branch(user, g.branch_id)
    if is_teacher_only(user) and g.teacher_id != user.id:
        raise HTTPException(403, "Bu guruh sizga biriktirilmagan")
    return g


@router.post("/", response_model=GroupResponse, status_code=201)
async def create_group(data: GroupCreate, db: MyDb, user: ManagerUser):
    ensure_branch(user, data.branch_id)
    branch = await check_ident(db, Branch, data.branch_id, "Filial topilmadi")
    if not branch.is_active:
        raise HTTPException(400, "Filial faol emas")
    course = await check_ident(db, Course, data.course_id, "Kurs topilmadi")
    if not course.is_active:
        raise HTTPException(400, "Kurs faol emas")
    if data.room_id:
        await _check_room(db, data.room_id, data.branch_id, data.max_students)
    if data.teacher_id:
        await _check_teacher(db, data.teacher_id)
    _check_dates(data.start_date, data.end_date)
    obj = Group(**data.model_dump())
    db.add(obj)
    await safe_commit(db)
    return obj


@router.get("/", response_model=Page[GroupResponse])
async def list_groups(db: MyDb, user: AuthUser, params: Pagination, branch_id: int | None = None,
                      status_: GroupStatus | None = Query(None, alias="status"), course_id: int | None = None,
                      teacher_id: int | None = None, q: str | None = None):
    stmt = scoped(select(Group), Group.branch_id, user).order_by(Group.id.desc())
    if is_teacher_only(user):
        stmt = stmt.where(Group.teacher_id == user.id)
    elif teacher_id is not None:
        stmt = stmt.where(Group.teacher_id == teacher_id)
    if branch_id is not None:
        stmt = stmt.where(Group.branch_id == branch_id)
    if status_ is not None:
        stmt = stmt.where(Group.status == status_)
    if course_id is not None:
        stmt = stmt.where(Group.course_id == course_id)
    if q:
        stmt = stmt.where(Group.name.ilike(f"%{q}%"))
    return await paginate(db, stmt, params)


@router.get("/{group_id}", response_model=GroupResponse)
async def get_group(group_id: int, db: MyDb, user: AuthUser):
    return await _load(db, user, group_id)


@router.put("/{group_id}", response_model=GroupResponse)
async def update_group(group_id: int, data: GroupUpdate, db: MyDb, user: ManagerUser):
    g = await _load(db, user, group_id)
    ch = data.model_dump(exclude_unset=True)
    if "course_id" in ch and ch["course_id"] != g.course_id:
        c = await check_ident(db, Course, ch["course_id"], "Kurs topilmadi")
        if not c.is_active:
            raise HTTPException(400, "Kurs faol emas")
    max_students = ch.get("max_students", g.max_students)
    if max_students < g.current_students:
        raise HTTPException(409, f"max_students joriy o'quvchilar sonidan ({g.current_students}) kam bo'lmasin")
    room_id = ch["room_id"] if "room_id" in ch else g.room_id
    if room_id and ("room_id" in ch or "max_students" in ch):  # max_students alohida o'zgarsa ham tekshiriladi
        await _check_room(db, room_id, g.branch_id, max_students)
    if ch.get("teacher_id") and ch["teacher_id"] != g.teacher_id:
        await _check_teacher(db, ch["teacher_id"], exclude_group_id=g.id)
    _check_dates(ch.get("start_date", g.start_date), ch.get("end_date", g.end_date))
    for k, v in ch.items():
        setattr(g, k, v)
    await safe_commit(db)
    return g


@router.get("/{group_id}/students", response_model=list[StudentResponse])
async def group_students(group_id: int, db: MyDb, user: AuthUser):
    await _load(db, user, group_id)
    stmt = (select(Student).join(Enrollment, Enrollment.student_id == Student.id)
            .where(Enrollment.group_id == group_id, Enrollment.status == EnrollmentStatus.ACTIVE)
            .order_by(Student.last_name, Student.first_name))
    return (await db.execute(stmt)).scalars().all()


# ---------- dars jadvali ----------
@router.get("/{group_id}/schedules", response_model=list[ScheduleResponse])
async def list_schedules(group_id: int, db: MyDb, user: AuthUser):
    await _load(db, user, group_id)
    return (await db.execute(select(GroupSchedule).where(GroupSchedule.group_id == group_id)
                             .order_by(GroupSchedule.weekday, GroupSchedule.start_time))).scalars().all()


@router.post("/{group_id}/schedules", response_model=ScheduleResponse, status_code=201)
async def add_schedule(group_id: int, data: ScheduleCreate, db: MyDb, user: ManagerUser):
    g = await _load(db, user, group_id)
    if data.end_time <= data.start_time:
        raise HTTPException(400, "end_time start_time dan keyin bo'lishi kerak")
    if data.room_id:
        await _check_room(db, data.room_id, g.branch_id, g.max_students)
    msg = await schedule_conflict(db, group=g, weekday=data.weekday, start=data.start_time, end=data.end_time,
                                  room_id=data.room_id)
    if msg:
        raise HTTPException(409, msg)
    obj = GroupSchedule(group_id=g.id, **data.model_dump())
    db.add(obj)
    await safe_commit(db)
    return obj


@router.put("/{group_id}/schedules/{schedule_id}", response_model=ScheduleResponse)
async def update_schedule(group_id: int, schedule_id: int, data: ScheduleUpdate, db: MyDb, user: ManagerUser):
    g = await _load(db, user, group_id)
    sc = await check_ident(db, GroupSchedule, schedule_id, "Jadval topilmadi")
    if sc.group_id != g.id:
        raise HTTPException(404, "Jadval topilmadi")
    ch = data.model_dump(exclude_unset=True)
    start, end = ch.get("start_time", sc.start_time), ch.get("end_time", sc.end_time)
    if end <= start:
        raise HTTPException(400, "end_time start_time dan keyin bo'lishi kerak")
    room_id = ch["room_id"] if "room_id" in ch else sc.room_id
    if room_id:
        await _check_room(db, room_id, g.branch_id, g.max_students)
    msg = await schedule_conflict(db, group=g, weekday=ch.get("weekday", sc.weekday), start=start, end=end,
                                  room_id=room_id, exclude_id=sc.id)
    if msg:
        raise HTTPException(409, msg)
    for k, v in ch.items():
        setattr(sc, k, v)
    await safe_commit(db)
    return sc


@router.delete("/{group_id}/schedules/{schedule_id}", response_model=Message)
async def delete_schedule(group_id: int, schedule_id: int, db: MyDb, user: ManagerUser):
    g = await _load(db, user, group_id)
    sc = await check_ident(db, GroupSchedule, schedule_id, "Jadval topilmadi")
    if sc.group_id != g.id:
        raise HTTPException(404, "Jadval topilmadi")
    await db.delete(sc)
    await safe_commit(db)
    return Message(msg="Jadval o'chirildi")
