from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select
from app.models.enums import EnrollmentStatus as ES
from app.models.groups import Group
from app.models.students import Enrollment, Student
from app.schemes.students import (EnrollmentCreate, EnrollmentPriceChange, EnrollmentResponse,
                                  EnrollmentStatusChange)
from app.services.enrollment import enroll_student, recount_group
from app.utils.access import ensure_branch, is_teacher_only, scoped
from app.utils.audit import add_audit
from app.utils.checked import check_ident, safe_commit
from app.utils.deps import MyDb
from app.utils.pagination import Page, Pagination, paginate
from app.utils.permissions import AuthUser, ManagerUser
from app.utils.time import today

router = APIRouter(prefix="/enrollments", tags=["Enrollments"])


async def _load(db, user, enr_id: int) -> Enrollment:
    e = await check_ident(db, Enrollment, enr_id, "Yozilish topilmadi")
    ensure_branch(user, (await db.get(Group, e.group_id)).branch_id)
    return e


@router.post("/", response_model=EnrollmentResponse, status_code=201)
async def create_enrollment(data: EnrollmentCreate, db: MyDb, user: ManagerUser):
    student = await check_ident(db, Student, data.student_id, "O'quvchi topilmadi")
    ensure_branch(user, student.branch_id)
    enr = await enroll_student(db, student, data.group_id, data.price, data.joined_at)
    add_audit(db, user, "create", "enrollment", enr.id, new={"student_id": student.id, "group_id": data.group_id})
    await safe_commit(db)
    return enr


@router.get("/", response_model=Page[EnrollmentResponse])
async def list_enrollments(db: MyDb, user: AuthUser, params: Pagination, student_id: int | None = None,
                           group_id: int | None = None, status_: ES | None = Query(None, alias="status")):
    stmt = (select(Enrollment).join(Group, Group.id == Enrollment.group_id).order_by(Enrollment.id.desc()))
    stmt = scoped(stmt, Group.branch_id, user)
    if is_teacher_only(user):
        stmt = stmt.where(Group.teacher_id == user.id)
    if student_id is not None:
        stmt = stmt.where(Enrollment.student_id == student_id)
    if group_id is not None:
        stmt = stmt.where(Enrollment.group_id == group_id)
    if status_ is not None:
        stmt = stmt.where(Enrollment.status == status_)
    return await paginate(db, stmt, params)


@router.get("/{enrollment_id}", response_model=EnrollmentResponse)
async def get_enrollment(enrollment_id: int, db: MyDb, user: AuthUser):
    return await _load(db, user, enrollment_id)


@router.patch("/{enrollment_id}/status", response_model=EnrollmentResponse)
async def change_status(enrollment_id: int, data: EnrollmentStatusChange, db: MyDb, user: ManagerUser):
    e = await _load(db, user, enrollment_id)
    if data.status == e.status:
        return e
    group = await db.get(Group, e.group_id, with_for_update=True, populate_existing=True)
    if data.status == ES.ACTIVE:  # qayta faollashtirish: sig'imni tekshiramiz
        await recount_group(db, group)
        if group.current_students >= group.max_students:
            raise HTTPException(409, "Guruh to'lgan")
        e.left_at = None
    elif data.status in (ES.DROPPED, ES.COMPLETED):
        e.left_at = data.left_at or today()
    old = e.status
    e.status = data.status
    await db.flush()
    await recount_group(db, group)
    add_audit(db, user, "update", "enrollment_status", e.id, old={"status": old.value}, new={"status": data.status.value})
    await safe_commit(db)
    return e


@router.patch("/{enrollment_id}/price", response_model=EnrollmentResponse)
async def change_price(enrollment_id: int, data: EnrollmentPriceChange, db: MyDb, user: ManagerUser):
    """Narx faqat KELAJAKDAGI hisoblarga ta'sir qiladi (yozilgan invoice o'zgarmaydi)."""
    e = await _load(db, user, enrollment_id)
    old = str(e.price)
    e.price = data.price
    add_audit(db, user, "update", "enrollment_price", e.id, old={"price": old}, new={"price": str(data.price)})
    await safe_commit(db)
    return e
