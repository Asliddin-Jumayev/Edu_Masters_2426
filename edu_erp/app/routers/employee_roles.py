from fastapi import APIRouter, HTTPException
from sqlalchemy import select
from app.models.branches import Branch
from app.models.employee_roles import EmployeeRole
from app.models.employees import Employee
from app.models.roles import Role
from app.schemes.common import Message
from app.schemes.employee_roles import EmployeeRoleCreate, EmployeeRoleResponse, EmployeeRoleUpdate
from app.services.accounts import active_admin_count
from app.utils.access import ensure_branch, is_admin
from app.utils.audit import add_audit
from app.utils.checked import check_ident, safe_commit
from app.utils.deps import MyDb
from app.utils.permissions import ManagerUser
from app.utils.roles import ADMIN

router = APIRouter(prefix="/employee-roles", tags=["Employee roles"])


def _resp(er: EmployeeRole, code: str) -> EmployeeRoleResponse:
    return EmployeeRoleResponse(id=er.id, employee_id=er.employee_id, role_id=er.role_id,
                                branch_id=er.branch_id, role_code=code)


def _check_rights(user, role: Role, branch_id: int | None):
    """manager faqat o'z filialida rol bera oladi; admin rolini va 'hamma filial' ni faqat admin."""
    if is_admin(user):
        return
    if role.code == ADMIN:
        raise HTTPException(403, "Admin rolini faqat admin bera oladi")
    if branch_id is None:
        raise HTTPException(403, "Barcha filiallar uchun rolni faqat admin bera oladi")
    ensure_branch(user, branch_id)


@router.get("/", response_model=list[EmployeeRoleResponse])
async def list_employee_roles(db: MyDb, user: ManagerUser, employee_id: int | None = None,
                              role_id: int | None = None, branch_id: int | None = None):
    stmt = select(EmployeeRole, Role.code).join(Role, Role.id == EmployeeRole.role_id)
    if employee_id is not None:
        stmt = stmt.where(EmployeeRole.employee_id == employee_id)
    if role_id is not None:
        stmt = stmt.where(EmployeeRole.role_id == role_id)
    if branch_id is not None:
        stmt = stmt.where(EmployeeRole.branch_id == branch_id)
    return [_resp(er, code) for er, code in (await db.execute(stmt)).all()]


@router.post("/", response_model=EmployeeRoleResponse, status_code=201)
async def assign_role(data: EmployeeRoleCreate, db: MyDb, user: ManagerUser):
    emp = await check_ident(db, Employee, data.employee_id, "Xodim topilmadi")
    role = await check_ident(db, Role, data.role_id, "Rol topilmadi")
    if data.branch_id is not None:
        await check_ident(db, Branch, data.branch_id, "Filial topilmadi")
    _check_rights(user, role, data.branch_id)
    dup = await db.scalar(select(EmployeeRole.id).where(
        EmployeeRole.employee_id == emp.id, EmployeeRole.role_id == role.id,
        EmployeeRole.branch_id == data.branch_id))  # None -> IS NULL
    if dup:
        raise HTTPException(409, "Xodimda bu rol shu filial uchun allaqachon bor")
    obj = EmployeeRole(**data.model_dump())
    db.add(obj)
    await db.flush()
    add_audit(db, user, "create", "employee_role", obj.id, new=data.model_dump())
    await safe_commit(db)
    return _resp(obj, role.code)


@router.put("/{er_id}", response_model=EmployeeRoleResponse)
async def change_branch(er_id: int, data: EmployeeRoleUpdate, db: MyDb, user: ManagerUser):
    er = await check_ident(db, EmployeeRole, er_id, "Biriktirish topilmadi")
    role = await db.get(Role, er.role_id)
    _check_rights(user, role, er.branch_id)
    _check_rights(user, role, data.branch_id)
    if data.branch_id is not None:
        await check_ident(db, Branch, data.branch_id, "Filial topilmadi")
    dup = await db.scalar(select(EmployeeRole.id).where(
        EmployeeRole.employee_id == er.employee_id, EmployeeRole.role_id == er.role_id,
        EmployeeRole.branch_id == data.branch_id, EmployeeRole.id != er.id))
    if dup:
        raise HTTPException(409, "Xodimda bu rol shu filial uchun allaqachon bor")
    er.branch_id = data.branch_id
    await safe_commit(db)
    return _resp(er, role.code)


@router.delete("/{er_id}", response_model=Message)
async def remove_role(er_id: int, db: MyDb, user: ManagerUser):
    er = await check_ident(db, EmployeeRole, er_id, "Biriktirish topilmadi")
    role = await db.get(Role, er.role_id)
    _check_rights(user, role, er.branch_id)
    if role.code == ADMIN and await active_admin_count(db) <= 1:
        raise HTTPException(409, "Oxirgi adminning admin rolini olib tashlab bo'lmaydi")
    add_audit(db, user, "delete", "employee_role", er.id, old={"employee_id": er.employee_id, "role_id": er.role_id,
                                                              "branch_id": er.branch_id})
    await db.delete(er)
    await safe_commit(db)
    return Message(msg="Rol olib tashlandi")
