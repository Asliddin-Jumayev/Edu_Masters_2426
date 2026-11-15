from pydantic import BaseModel, Field
from app.schemes.common import ORM


class TeacherProfileSelf(BaseModel):  # o'qituvchi o'zi tahrirlay oladigan maydonlar
    bio: str | None = None
    specialization: str | None = Field(None, max_length=255)
    experience_years: int = Field(0, ge=0, le=80)


class TeacherProfileSelfUpdate(BaseModel):
    bio: str | None = None
    specialization: str | None = Field(None, max_length=255)
    experience_years: int | None = Field(None, ge=0, le=80)


class TeacherProfileAdminCreate(TeacherProfileSelf):
    employee_id: int
    max_groups: int = Field(5, ge=1, le=50)


class TeacherProfileAdminUpdate(TeacherProfileSelfUpdate):
    max_groups: int | None = Field(None, ge=1, le=50)


class TeacherProfileResponse(ORM):
    employee_id: int
    bio: str | None
    specialization: str | None
    experience_years: int
    max_groups: int
