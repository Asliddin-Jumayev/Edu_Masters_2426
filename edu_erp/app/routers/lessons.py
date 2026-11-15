import datetime as dt
from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select
from app.models.enums import AttendanceStatus, EnrollmentStatus, SessionStatus
from app.models.groups import Group
from app.models.lessons import Attendance, LessonSession
from app.models.students import Enrollment
from app.schemes.common import Message
from app.schemes.lessons import (AttendanceBulk, AttendanceResponse, SessionCreate, SessionGenerate,
                                 SessionGenerateResult, SessionResponse, SessionUpdate)
from app.services.accounts import employee_has_role
from app.services.scheduling import generate_sessions, session_conflict
from app.utils.access import ensure_branch, has_role, is_teacher_only, scoped
from app.utils.checked import check_ident, safe_commit
from app.utils.deps import MyDb
from app.utils.pagination import Page, Pagination, paginate
from app.utils.permissions import AuthUser, ManagerUser
from app.utils.roles import ADMIN, MANAGER, TEACHER
from app.utils.time import today, utcnow

router = APIRouter(prefix="/lesson-sessions", tags=["Lessons & attendance"])


async def _load(db, user, session_id: int, *, write: bool = False) -> tuple[LessonSession, Group]:
    s = await check_ident(db, LessonSession, session_id, "Dars topilmadi")
    g = await db.get(Group, s.group_id)
    ensure_branch(user, g.branch_id)
    if is_teacher_only(user):
        if (s.teacher_id or g.teacher_id) != user.id:
            raise HTTPException(403, "Bu dars sizga biriktirilmagan")
    return s, g


@router.post("/generate", response_model=SessionGenerateResult)
async def generate(data: SessionGenerate, db: MyDb, user: ManagerUser):
    """Guruh jadvali bo'yicha darslarni yaratadi (mavjudlari o'tkazib yuboriladi, to'qnashuvlar ro'yxatda)."""
    g = await check_ident(db, Group, data.group_id, "Guruh topilmadi")
    ensure_branch(user, g.branch_id)
    start = data.date_from or g.start_date or today()
    end = data.date_to or g.end_date or (start + dt.timedelta(days=30))
    if g.end_date and end > g.end_date:
        end = g.end_date
    res = await generate_sessions(db, g, start, end)
    await safe_commit(db)
    return res


@router.post("/", response_model=SessionResponse, status_code=201)
async def create_session(data: SessionCreate, db: MyDb, user: ManagerUser):
    g = await check_ident(db, Group, data.group_id, "Guruh topilmadi")
    ensure_branch(user, g.branch_id)
    teacher_id = data.teacher_id or g.teacher_id
    room_id = data.room_id or g.room_id
    msg = await session_conflict(db, teacher_id=teacher_id, room_id=room_id, day=data.date,
                                 start=data.start_time, end=data.end_time)
    if msg:
        raise HTTPException(409, msg)
    obj = LessonSession(**{**data.model_dump(), "teacher_id": teacher_id, "room_id": room_id})
    db.add(obj)
    await safe_commit(db, "Bu guruhda shu sana va vaqtda dars allaqachon bor")
    return obj


@router.get("/", response_model=Page[SessionResponse])
async def list_sessions(db: MyDb, user: AuthUser, params: Pagination, group_id: int | None = None,
                        teacher_id: int | None = None, date_from: dt.date | None = None,
                        date_to: dt.date | None = None, status_: SessionStatus | None = Query(None, alias="status")):
    stmt = (select(LessonSession).join(Group, Group.id == LessonSession.group_id)
            .order_by(LessonSession.date, LessonSession.start_time))
    stmt = scoped(stmt, Group.branch_id, user)
    if is_teacher_only(user):
        stmt = stmt.where(LessonSession.teacher_id == user.id)
    elif teacher_id is not None:
        stmt = stmt.where(LessonSession.teacher_id == teacher_id)
    if group_id is not None:
        stmt = stmt.where(LessonSession.group_id == group_id)
    if date_from:
        stmt = stmt.where(LessonSession.date >= date_from)
    if date_to:
        stmt = stmt.where(LessonSession.date <= date_to)
    if status_ is not None:
        stmt = stmt.where(LessonSession.status == status_)
    return await paginate(db, stmt, params)


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(session_id: int, db: MyDb, user: AuthUser):
    return (await _load(db, user, session_id))[0]


@router.put("/{session_id}", response_model=SessionResponse)
async def update_session(session_id: int, data: SessionUpdate, db: MyDb, user: AuthUser):
    s, g = await _load(db, user, session_id)
    ch = data.model_dump(exclude_unset=True)
    if is_teacher_only(user):  # o'qituvchi faqat mavzu, izoh va holatni o'zgartira oladi
        if set(ch) - {"topic", "note", "status"}:
            raise HTTPException(403, "O'qituvchi faqat mavzu, izoh va holatni o'zgartira oladi")
    if ch.get("status") == SessionStatus.PLANNED and s.status == SessionStatus.HELD:
        raise HTTPException(409, "O'tilgan darsni qayta 'planned' qilib bo'lmaydi")
    if {"date", "start_time", "end_time", "teacher_id", "room_id"} & set(ch):
        day, st, en = ch.get("date", s.date), ch.get("start_time", s.start_time), ch.get("end_time", s.end_time)
        if en <= st:
            raise HTTPException(400, "end_time start_time dan keyin bo'lishi kerak")
        msg = await session_conflict(db, teacher_id=ch.get("teacher_id", s.teacher_id),
                                     room_id=ch.get("room_id", s.room_id), day=day, start=st, end=en,
                                     exclude_id=s.id)
        if msg:
            raise HTTPException(409, msg)
    for k, v in ch.items():
        setattr(s, k, v)
    await safe_commit(db, "Bu guruhda shu sana va vaqtda dars allaqachon bor")
    return s


@router.delete("/{session_id}", response_model=Message)
async def delete_session(session_id: int, db: MyDb, user: ManagerUser):
    s, _ = await _load(db, user, session_id)
    if s.status == SessionStatus.HELD:
        raise HTTPException(409, "O'tilgan darsni o'chirib bo'lmaydi; bekor qiling yoki holatini saqlang")
    if await db.scalar(select(Attendance.id).where(Attendance.session_id == s.id).limit(1)):
        raise HTTPException(409, "Darsda davomat belgilangan")
    await db.delete(s)
    await safe_commit(db)
    return Message(msg="Dars o'chirildi")


# ---------- davomat ----------
@router.get("/{session_id}/attendance", response_model=list[AttendanceResponse])
async def get_attendance(session_id: int, db: MyDb, user: AuthUser):
    s, _ = await _load(db, user, session_id)
    return (await db.execute(select(Attendance).where(Attendance.session_id == s.id))).scalars().all()


@router.put("/{session_id}/attendance", response_model=list[AttendanceResponse])
async def mark_attendance(session_id: int, data: AttendanceBulk, db: MyDb, user: AuthUser):
    """Ommaviy belgilash (mavjud bo'lsa yangilanadi). Dars 'planned' bo'lsa avtomatik 'held' bo'ladi."""
    if not has_role(user, ADMIN, MANAGER, TEACHER):
        raise HTTPException(403, "Ruxsat yo'q")
    s, g = await _load(db, user, session_id)
    if s.status == SessionStatus.CANCELLED:
        raise HTTPException(409, "Bekor qilingan darsda davomat belgilanmaydi")
    enrolled = set((await db.execute(select(Enrollment.student_id).where(
        Enrollment.group_id == g.id, Enrollment.status.in_([EnrollmentStatus.ACTIVE, EnrollmentStatus.FROZEN]))))
        .scalars().all())
    ids = [i.student_id for i in data.items]
    if len(set(ids)) != len(ids):
        raise HTTPException(400, "Bir o'quvchi ikki marta kiritilgan")
    bad = [i for i in ids if i not in enrolled]
    if bad:
        raise HTTPException(400, f"Guruhga yozilmagan o'quvchilar: {bad}")
    existing = {a.student_id: a for a in (await db.execute(
        select(Attendance).where(Attendance.session_id == s.id))).scalars().all()}
    out = []
    for it in data.items:
        a = existing.get(it.student_id)
        if a is None:
            a = Attendance(session_id=s.id, student_id=it.student_id, status=it.status, note=it.note,
                           marked_by=user.id, marked_at=utcnow())
            db.add(a)
        else:
            a.status, a.note, a.marked_by, a.marked_at = it.status, it.note, user.id, utcnow()
        out.append(a)
    if s.status == SessionStatus.PLANNED:
        s.status = SessionStatus.HELD
    await safe_commit(db)
    return out


attendance_router = APIRouter(prefix="/attendances", tags=["Lessons & attendance"])


@attendance_router.get("/", response_model=Page[AttendanceResponse])
async def list_attendances(db: MyDb, user: AuthUser, params: Pagination, student_id: int | None = None,
                           group_id: int | None = None, date_from: dt.date | None = None,
                           date_to: dt.date | None = None,
                           status_: AttendanceStatus | None = Query(None, alias="status")):
    stmt = (select(Attendance).join(LessonSession, LessonSession.id == Attendance.session_id)
            .join(Group, Group.id == LessonSession.group_id).order_by(Attendance.id.desc()))
    stmt = scoped(stmt, Group.branch_id, user)
    if is_teacher_only(user):
        stmt = stmt.where(Group.teacher_id == user.id)
    if student_id is not None:
        stmt = stmt.where(Attendance.student_id == student_id)
    if group_id is not None:
        stmt = stmt.where(LessonSession.group_id == group_id)
    if date_from:
        stmt = stmt.where(LessonSession.date >= date_from)
    if date_to:
        stmt = stmt.where(LessonSession.date <= date_to)
    if status_ is not None:
        stmt = stmt.where(Attendance.status == status_)
    return await paginate(db, stmt, params)
