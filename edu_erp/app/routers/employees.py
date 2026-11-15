from fastapi import APIRouter, HTTPException
from sqlalchemy import or_, select
from app.models.branches import Branch
from app.models.employee_roles import EmployeeRole
from app.models.employees import Employee
from app.models.roles import Role
from app.schemes.common import Message
from app.schemes.employees import (EmployeeCreate, EmployeeResponse, EmployeeUpdate, FireRequest, PasswordReset)
from app.services.accounts import active_admin_count, employee_has_role
from app.utils.access import ensure_branch, has_role, scoped
from app.utils.audit import add_audit, snapshot
from app.utils.checked import check_ident, ensure_unique, safe_commit
from app.utils.deps import MyDb
from app.utils.pagination import Page, Pagination, paginate
from app.utils.permissions import AdminUser, AuthUser, FinanceUser, ManagerUser
from app.utils.roles import ADMIN, MANAGER
from app.utils.security import get_password_hash
from app.utils.time import today

router = APIRouter(prefix="/employees", tags=["Employees"])
_SECRET = {"password_hash"}


@router.post("/", response_model=EmployeeResponse, status_code=201)
async def create_employee(data: EmployeeCreate, db: MyDb, user: ManagerUser):
    ensure_branch(user, data.branch_id)
    await check_ident(db, Branch, data.branch_id, "Filial topilmadi")
    await ensure_unique(db, Employee.phone, data.phone, msg="Bu telefon raqamli xodim allaqachon mavjud")
    obj = Employee(**data.model_dump(exclude={"password"}), password_hash=await get_password_hash(data.password))
    db.add(obj)
    await db.flush()
    add_audit(db, user, "create", "employee", obj.id, new=snapshot(obj, _SECRET))
    await safe_commit(db)
    return obj


@router.get("/", response_model=Page[EmployeeResponse])
async def list_employees(db: MyDb, user: FinanceUser, params: Pagination, is_active: bool | None = True,
                         branch_id: int | None = None, q: str | None = None, role: str | None = None):
    stmt = scoped(select(Employee), Employee.branch_id, user).order_by(Employee.last_name, Employee.first_name)
    if is_active is not None:
        stmt = stmt.where(Employee.is_active == is_active)
    if branch_id is not None:
        stmt = stmt.where(Employee.branch_id == branch_id)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(Employee.first_name.ilike(like), Employee.last_name.ilike(like),
                              Employee.phone.ilike(like)))
    if role:
        stmt = stmt.where(Employee.id.in_(
            select(EmployeeRole.employee_id).join(Role, Role.id == EmployeeRole.role_id).where(Role.code == role)))
    return await paginate(db, stmt, params)


@router.get("/{employee_id}", response_model=EmployeeResponse)
async def get_employee(employee_id: int, db: MyDb, user: AuthUser):
    emp = await check_ident(db, Employee, employee_id, "Xodim topilmadi")
    if emp.id != user.id:
        if not has_role(user, ADMIN, MANAGER):
            raise HTTPException(403, "Ruxsat yo'q")
        ensure_branch(user, emp.branch_id)
    return emp


@router.put("/{employee_id}", response_model=EmployeeResponse)
async def update_employee(employee_id: int, data: EmployeeUpdate, db: MyDb, user: ManagerUser):
    emp = await check_ident(db, Employee, employee_id, "Xodim topilmadi")
    ensure_branch(user, emp.branch_id)
    changes = data.model_dump(exclude_unset=True)
    if "branch_id" in changes and changes["branch_id"] != emp.branch_id:
        ensure_branch(user, changes["branch_id"])
        await check_ident(db, Branch, changes["branch_id"], "Filial topilmadi")
    if "phone" in changes and changes["phone"] != emp.phone:
        await ensure_unique(db, Employee.phone, changes["phone"], exclude_id=emp.id,
                            msg="Bu telefon raqamli xodim allaqachon mavjud")
    old = snapshot(emp, _SECRET)
    for k, v in changes.items():
        setattr(emp, k, v)
    add_audit(db, user, "update", "employee", emp.id, old=old, new=snapshot(emp, _SECRET))
    await safe_commit(db)
    return emp


@router.put("/{employee_id}/password", response_model=Message)
async def reset_password(employee_id: int, data: PasswordReset, db: MyDb, user: AdminUser):
    emp = await check_ident(db, Employee, employee_id, "Xodim topilmadi")
    emp.password_hash = await get_password_hash(data.new_password)
    add_audit(db, user, "update", "employee_password", emp.id)
    await safe_commit(db)
    return Message(msg="Parol yangilandi")


@router.post("/{employee_id}/fire", response_model=EmployeeResponse)
async def fire_employee(employee_id: int, db: MyDb, user: ManagerUser, data: FireRequest | None = None):
    """Xodim o'chirilmaydi: fired_at qo'yiladi, darslari va maoshi tarixda qoladi."""
    emp = await check_ident(db, Employee, employee_id, "Xodim topilmadi")
    ensure_branch(user, emp.branch_id)
    if emp.id == user.id:
        raise HTTPException(409, "O'zingizni ishdan bo'shata olmaysiz")
    if await employee_has_role(db, emp.id, ADMIN) and await active_admin_count(db) <= 1:
        raise HTTPException(409, "Oxirgi adminni ishdan bo'shatib bo'lmaydi")
    emp.is_active = False
    emp.fired_at = (data.fired_at if data and data.fired_at else today())
    add_audit(db, user, "update", "employee_fire", emp.id, new={"fired_at": emp.fired_at.isoformat()})
    await safe_commit(db)
    return emp


@router.post("/{employee_id}/reactivate", response_model=EmployeeResponse)
async def reactivate_employee(employee_id: int, db: MyDb, user: ManagerUser):
    emp = await check_ident(db, Employee, employee_id, "Xodim topilmadi")
    ensure_branch(user, emp.branch_id)
    emp.is_active = True
    emp.fired_at = None
    add_audit(db, user, "update", "employee_reactivate", emp.id)
    await safe_commit(db)
    return emp
