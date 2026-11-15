from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func, select
from app.models.branches import Branch
from app.schemes.branches import BranchCreate, BranchResponse, BranchUpdate
from app.schemes.common import Message
from app.utils.access import ensure_branch, scoped
from app.utils.checked import check_ident, ensure_unique, safe_commit
from app.utils.deps import MyDb
from app.utils.permissions import AdminUser, AuthUser, ManagerUser

router = APIRouter(prefix="/branches", tags=["Branches"])


@router.post("/", response_model=BranchResponse, status_code=201)
async def create_branch(data: BranchCreate, db: MyDb, user: AdminUser):
    await ensure_unique(db, Branch.code, data.code, msg="Bu kodli filial allaqachon mavjud")
    obj = Branch(**data.model_dump())
    db.add(obj)
    await safe_commit(db)
    return obj


@router.get("/", response_model=list[BranchResponse])
async def list_branches(db: MyDb, user: AuthUser, name: str | None = None, is_active: bool | None = None):
    stmt = scoped(select(Branch), Branch.id, user).order_by(Branch.name)
    if name:
        stmt = stmt.where(Branch.name.ilike(f"%{name}%"))
    if is_active is not None:
        stmt = stmt.where(Branch.is_active == is_active)
    return (await db.execute(stmt)).scalars().all()


@router.get("/{branch_id}", response_model=BranchResponse)
async def get_branch(branch_id: int, db: MyDb, user: AuthUser):
    ensure_branch(user, branch_id)
    return await check_ident(db, Branch, branch_id, "Filial topilmadi")


@router.put("/{branch_id}", response_model=BranchResponse)
async def update_branch(branch_id: int, data: BranchUpdate, db: MyDb, user: ManagerUser):
    ensure_branch(user, branch_id)
    branch = await check_ident(db, Branch, branch_id, "Filial topilmadi")
    changes = data.model_dump(exclude_unset=True)
    if "code" in changes and changes["code"] != branch.code:
        await ensure_unique(db, Branch.code, changes["code"], exclude_id=branch.id,
                            msg="Bu kodli filial allaqachon mavjud")
    for k, v in changes.items():
        setattr(branch, k, v)
    await safe_commit(db)
    return branch


@router.delete("/{branch_id}", response_model=Message)
async def deactivate_branch(branch_id: int, db: MyDb, user: AdminUser):
    """Filial o'chirilmaydi (tarixi kerak) — faqat faolsizlantiriladi."""
    branch = await check_ident(db, Branch, branch_id, "Filial topilmadi")
    branch.is_active = False
    await safe_commit(db)
    return Message(msg="Filial faolsizlantirildi")


@router.post("/{branch_id}/activate", response_model=Message)
async def activate_branch(branch_id: int, db: MyDb, user: AdminUser):
    branch = await check_ident(db, Branch, branch_id, "Filial topilmadi")
    branch.is_active = True
    await safe_commit(db)
    return Message(msg="Filial faollashtirildi")
