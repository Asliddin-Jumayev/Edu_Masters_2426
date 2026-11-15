from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import or_, select
from app.models.branches import Branch
from app.models.crm import LeadSource
from app.models.enums import BalanceTxnType, EnrollmentStatus, StudentStatus
from app.models.finance import StudentBalanceTransaction
from app.models.groups import Group
from app.models.students import Enrollment, Student
from app.schemes.common import Message
from app.schemes.students import (BalanceAdjust, BalanceTxnResponse, StudentCreate, StudentResponse, StudentUpdate)
from app.services.finance import add_ledger, recompute_invoices
from app.utils.access import ensure_branch, is_teacher_only, scoped
from app.utils.audit import add_audit, snapshot
from app.utils.checked import check_ident, safe_commit
from app.utils.deps import MyDb
from app.utils.pagination import Page, Pagination, paginate
from app.utils.permissions import AccountantUser, AuthUser, ManagerUser
from pydantic import BaseModel

router = APIRouter(prefix="/students", tags=["Students"])


class StatusBody(BaseModel):
    status: StudentStatus


async def load_student(db, user, student_id: int) -> Student:
    s = await check_ident(db, Student, student_id, "O'quvchi topilmadi")
    ensure_branch(user, s.branch_id)
    if is_teacher_only(user):
        ok = await db.scalar(select(Enrollment.id).join(Group, Group.id == Enrollment.group_id).where(
            Enrollment.student_id == s.id, Group.teacher_id == user.id).limit(1))
        if not ok:
            raise HTTPException(403, "Bu o'quvchi sizning guruhlaringizda emas")
    return s


@router.post("/", response_model=StudentResponse, status_code=201)
async def create_student(data: StudentCreate, db: MyDb, user: ManagerUser):
    ensure_branch(user, data.branch_id)
    await check_ident(db, Branch, data.branch_id, "Filial topilmadi")
    if data.source_id:
        await check_ident(db, LeadSource, data.source_id, "Manba topilmadi")
    if data.phone:
        dup = await db.scalar(select(Student.id).where(Student.branch_id == data.branch_id,
                                                       Student.phone == data.phone,
                                                       Student.first_name == data.first_name,
                                                       Student.last_name == data.last_name))
        if dup:
            raise HTTPException(409, "Bunday o'quvchi (ism, familiya, telefon) bu filialda allaqachon bor")
    obj = Student(**data.model_dump())
    db.add(obj)
    await db.flush()
    add_audit(db, user, "create", "student", obj.id, new=snapshot(obj))
    await safe_commit(db)
    return obj


@router.get("/", response_model=Page[StudentResponse])
async def list_students(db: MyDb, user: AuthUser, params: Pagination, branch_id: int | None = None,
                        status_: StudentStatus | None = Query(None, alias="status"), group_id: int | None = None,
                        q: str | None = None, debtors_only: bool = False):
    stmt = scoped(select(Student), Student.branch_id, user).order_by(Student.last_name, Student.first_name)
    if is_teacher_only(user):
        stmt = stmt.where(Student.id.in_(
            select(Enrollment.student_id).join(Group, Group.id == Enrollment.group_id)
            .where(Group.teacher_id == user.id, Enrollment.status == EnrollmentStatus.ACTIVE)))
    if branch_id is not None:
        stmt = stmt.where(Student.branch_id == branch_id)
    if status_ is not None:
        stmt = stmt.where(Student.status == status_)
    if group_id is not None:
        stmt = stmt.where(Student.id.in_(select(Enrollment.student_id).where(
            Enrollment.group_id == group_id, Enrollment.status == EnrollmentStatus.ACTIVE)))
    if debtors_only:
        stmt = stmt.where(Student.balance < 0)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(Student.first_name.ilike(like), Student.last_name.ilike(like),
                              Student.phone.ilike(like), Student.parent_phone.ilike(like)))
    return await paginate(db, stmt, params)


@router.get("/{student_id}", response_model=StudentResponse)
async def get_student(student_id: int, db: MyDb, user: AuthUser):
    return await load_student(db, user, student_id)


@router.put("/{student_id}", response_model=StudentResponse)
async def update_student(student_id: int, data: StudentUpdate, db: MyDb, user: ManagerUser):
    s = await load_student(db, user, student_id)
    ch = data.model_dump(exclude_unset=True)
    if ch.get("source_id"):
        await check_ident(db, LeadSource, ch["source_id"], "Manba topilmadi")
    old = snapshot(s)
    for k, v in ch.items():
        setattr(s, k, v)
    if not s.phone and not s.parent_phone:
        raise HTTPException(400, "phone yoki parent_phone dan kamida bittasi kerak")
    add_audit(db, user, "update", "student", s.id, old=old, new=snapshot(s))
    await safe_commit(db)
    return s


@router.patch("/{student_id}/status", response_model=StudentResponse)
async def set_status(student_id: int, data: StatusBody, db: MyDb, user: ManagerUser):
    s = await load_student(db, user, student_id)
    old = s.status
    s.status = data.status
    add_audit(db, user, "update", "student_status", s.id, old={"status": old.value}, new={"status": data.status.value})
    await safe_commit(db)
    return s


@router.delete("/{student_id}", response_model=Message)
async def leave_student(student_id: int, db: MyDb, user: ManagerUser):
    """O'quvchi o'chirilmaydi (to'lov tarixi bor) — 'left' holatiga o'tkaziladi."""
    s = await load_student(db, user, student_id)
    s.status = StudentStatus.LEFT
    add_audit(db, user, "update", "student_status", s.id, new={"status": "left"})
    await safe_commit(db)
    return Message(msg="O'quvchi 'left' holatiga o'tkazildi")


@router.get("/{student_id}/balance", response_model=Page[BalanceTxnResponse])
async def balance_history(student_id: int, db: MyDb, user: AuthUser, params: Pagination):
    s = await load_student(db, user, student_id)
    stmt = (select(StudentBalanceTransaction).where(StudentBalanceTransaction.student_id == s.id)
            .order_by(StudentBalanceTransaction.id.desc()))
    return await paginate(db, stmt, params)


@router.post("/{student_id}/balance/adjust", response_model=BalanceTxnResponse, status_code=201)
async def adjust_balance(student_id: int, data: BalanceAdjust, db: MyDb, user: AccountantUser):
    s = await load_student(db, user, student_id)
    txn = await add_ledger(db, s.id, BalanceTxnType.ADJUSTMENT, data.amount, "manual", None, user)
    await recompute_invoices(db, s.id)
    add_audit(db, user, "adjust", "student_balance", s.id, new={"amount": str(data.amount), "reason": data.reason})
    await safe_commit(db)
    return txn
