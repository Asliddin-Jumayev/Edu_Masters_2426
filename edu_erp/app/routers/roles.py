from fastapi import APIRouter, HTTPException
from sqlalchemy import select
from app.models.employee_roles import EmployeeRole
from app.models.roles import Role
from app.schemes.common import Message
from app.schemes.roles import RoleCreate, RoleResponse, RoleUpdate
from app.utils.checked import check_ident, ensure_unique, safe_commit
from app.utils.deps import MyDb
from app.utils.permissions import AdminUser, ManagerUser

router = APIRouter(prefix="/roles", tags=["Roles"])


@router.get("/", response_model=list[RoleResponse])
async def list_roles(db: MyDb, user: ManagerUser):
    return (await db.execute(select(Role).order_by(Role.id))).scalars().all()


@router.post("/", response_model=RoleResponse, status_code=201)
async def create_role(data: RoleCreate, db: MyDb, user: AdminUser):
    await ensure_unique(db, Role.code, data.code, msg="Bu kodli rol allaqachon mavjud")
    obj = Role(**data.model_dump(), is_system=False)
    db.add(obj)
    await safe_commit(db)
    return obj


@router.put("/{role_id}", response_model=RoleResponse)
async def update_role(role_id: int, data: RoleUpdate, db: MyDb, user: AdminUser):
    role = await check_ident(db, Role, role_id, "Rol topilmadi")
    changes = data.model_dump(exclude_unset=True)
    if "code" in changes and changes["code"] != role.code:
        if role.is_system:
            raise HTTPException(409, "Tizim rolining kodini o'zgartirib bo'lmaydi")
        await ensure_unique(db, Role.code, changes["code"], exclude_id=role.id, msg="Bu kodli rol allaqachon mavjud")
    for k, v in changes.items():
        setattr(role, k, v)
    await safe_commit(db)
    return role


@router.delete("/{role_id}", response_model=Message)
async def delete_role(role_id: int, db: MyDb, user: AdminUser):
    role = await check_ident(db, Role, role_id, "Rol topilmadi")
    if role.is_system:
        raise HTTPException(409, "Tizim rolini o'chirib bo'lmaydi")
    if await db.scalar(select(EmployeeRole.id).where(EmployeeRole.role_id == role.id).limit(1)):
        raise HTTPException(409, "Bu rol xodimlarga biriktirilgan")
    await db.delete(role)
    await safe_commit(db)
    return Message(msg="Rol o'chirildi")
