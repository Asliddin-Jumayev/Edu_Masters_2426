from fastapi import APIRouter
from sqlalchemy import select
from app.models.courses import Course
from app.schemes.common import Message
from app.schemes.courses import CourseCreate, CourseResponse, CourseUpdate
from app.utils.checked import check_ident, safe_commit
from app.utils.deps import MyDb
from app.utils.permissions import AuthUser, ManagerUser

router = APIRouter(prefix="/courses", tags=["Courses"])


@router.post("/", response_model=CourseResponse, status_code=201)
async def create_course(data: CourseCreate, db: MyDb, user: ManagerUser):
    obj = Course(**data.model_dump())
    db.add(obj)
    await safe_commit(db)
    return obj


@router.get("/", response_model=list[CourseResponse])
async def list_courses(db: MyDb, user: AuthUser, is_active: bool | None = None, q: str | None = None):
    stmt = select(Course).order_by(Course.name)
    if is_active is not None:
        stmt = stmt.where(Course.is_active == is_active)
    if q:
        stmt = stmt.where(Course.name.ilike(f"%{q}%"))
    return (await db.execute(stmt)).scalars().all()


@router.get("/{course_id}", response_model=CourseResponse)
async def get_course(course_id: int, db: MyDb, user: AuthUser):
    return await check_ident(db, Course, course_id, "Kurs topilmadi")


@router.put("/{course_id}", response_model=CourseResponse)
async def update_course(course_id: int, data: CourseUpdate, db: MyDb, user: ManagerUser):
    course = await check_ident(db, Course, course_id, "Kurs topilmadi")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(course, k, v)
    await safe_commit(db)
    return course


@router.delete("/{course_id}", response_model=Message)
async def deactivate_course(course_id: int, db: MyDb, user: ManagerUser):
    course = await check_ident(db, Course, course_id, "Kurs topilmadi")
    course.is_active = False
    await safe_commit(db)
    return Message(msg="Kurs faolsizlantirildi")
