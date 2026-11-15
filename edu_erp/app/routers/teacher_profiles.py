from fastapi import APIRouter, HTTPException
from sqlalchemy import select
from app.models.employees import Employee
from app.models.teacher_profiles import TeacherProfile
from app.schemes.common import Message
from app.schemes.teacher_profiles import (TeacherProfileAdminCreate, TeacherProfileAdminUpdate,
                                          TeacherProfileResponse, TeacherProfileSelf, TeacherProfileSelfUpdate)
from app.services.accounts import employee_has_role
from app.utils.access import ensure_branch, has_role
from app.utils.checked import check_ident, safe_commit
from app.utils.deps import MyDb
from app.utils.pagination import Page, Pagination, paginate
from app.utils.permissions import AuthUser, ManagerUser
from app.utils.roles import ADMIN, MANAGER, TEACHER

router = APIRouter(prefix="/teacher-profiles", tags=["Teacher profiles"])


async def _get(db, employee_id: int) -> TeacherProfile:
    p = await db.get(TeacherProfile, employee_id)
    if p is None:
        raise HTTPException(404, "O'qituvchi profili topilmadi")
    return p


@router.get("/me", response_model=TeacherProfileResponse)
async def my_profile(db: MyDb, user: AuthUser):
    return await _get(db, user.id)


@router.post("/me", response_model=TeacherProfileResponse, status_code=201)
async def create_my_profile(data: TeacherProfileSelf, db: MyDb, user: AuthUser):
    if not has_role(user, TEACHER):
        raise HTTPException(403, "Faqat o'qituvchi roli bor xodim profil yarata oladi")
    if await db.get(TeacherProfile, user.id):
        raise HTTPException(409, "Profil allaqachon mavjud")
    obj = TeacherProfile(employee_id=user.id, **data.model_dump())  # max_groups — default; uni faqat manager o'zgartiradi
    db.add(obj)
    await safe_commit(db)
    return obj


@router.post("/", response_model=TeacherProfileResponse, status_code=201)
async def create_profile(data: TeacherProfileAdminCreate, db: MyDb, user: ManagerUser):
    emp = await check_ident(db, Employee, data.employee_id, "Xodim topilmadi")
    ensure_branch(user, emp.branch_id)
    if not await employee_has_role(db, emp.id, TEACHER):
        raise HTTPException(400, "Xodimda 'teacher' roli yo'q")
    if await db.get(TeacherProfile, emp.id):
        raise HTTPException(409, "Profil allaqachon mavjud")
    obj = TeacherProfile(**data.model_dump())
    db.add(obj)
    await safe_commit(db)
    return obj


@router.get("/", response_model=Page[TeacherProfileResponse])
async def list_profiles(db: MyDb, user: AuthUser, params: Pagination):
    return await paginate(db, select(TeacherProfile).order_by(TeacherProfile.employee_id), params)


@router.get("/{employee_id}", response_model=TeacherProfileResponse)
async def get_profile(employee_id: int, db: MyDb, user: AuthUser):
    return await _get(db, employee_id)


@router.put("/{employee_id}", response_model=TeacherProfileResponse)
async def update_profile(employee_id: int, data: TeacherProfileAdminUpdate,
                         db: MyDb, user: AuthUser):
    is_mgr = has_role(user, ADMIN, MANAGER)
    if not is_mgr and user.id != employee_id:
        raise HTTPException(403, "Siz faqat o'z profilingizni o'zgartira olasiz")
    profile = await _get(db, employee_id)
    changes = data.model_dump(exclude_unset=True)
    if not is_mgr and "max_groups" in changes:
        raise HTTPException(403, "max_groups ni faqat manager/admin o'zgartira oladi")
    if is_mgr and user.id != employee_id:
        emp = await db.get(Employee, employee_id)
        ensure_branch(user, emp.branch_id)
    for k, v in changes.items():
        setattr(profile, k, v)
    await safe_commit(db)
    return profile


@router.delete("/{employee_id}", response_model=Message)
async def delete_profile(employee_id: int, db: MyDb, user: ManagerUser):
    profile = await _get(db, employee_id)
    emp = await db.get(Employee, employee_id)
    ensure_branch(user, emp.branch_id)
    await db.delete(profile)
    await safe_commit(db)
    return Message(msg="Profil o'chirildi")
