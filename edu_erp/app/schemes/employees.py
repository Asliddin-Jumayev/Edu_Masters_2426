import datetime as dt
from pydantic import BaseModel, Field
from app.schemes.common import ORM, Phone

EMAIL = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"


class EmployeeCreate(BaseModel):
    branch_id: int
    first_name: str = Field(min_length=1, max_length=60)
    last_name: str = Field(min_length=1, max_length=60)
    phone: Phone
    email: str | None = Field(None, pattern=EMAIL, max_length=255)
    password: str = Field(min_length=8, max_length=128)
    birth_date: dt.date | None = None
    photo_url: str | None = None
    position: str = Field(min_length=1, max_length=80)
    hired_at: dt.date


class EmployeeUpdate(BaseModel):  # parol bu yerda YO'Q — alohida endpoint
    branch_id: int | None = None
    first_name: str | None = Field(None, min_length=1, max_length=60)
    last_name: str | None = Field(None, min_length=1, max_length=60)
    phone: Phone | None = None
    email: str | None = Field(None, pattern=EMAIL, max_length=255)
    birth_date: dt.date | None = None
    photo_url: str | None = None
    position: str | None = Field(None, min_length=1, max_length=80)
    hired_at: dt.date | None = None


class PasswordReset(BaseModel):
    new_password: str = Field(min_length=8, max_length=128)


class FireRequest(BaseModel):
    fired_at: dt.date | None = None


class EmployeeResponse(ORM):  # password_hash hech qachon qaytarilmaydi
    id: int
    branch_id: int
    first_name: str
    last_name: str
    phone: str
    email: str | None
    birth_date: dt.date | None
    photo_url: str | None
    position: str
    hired_at: dt.date
    fired_at: dt.date | None
    is_active: bool
    created_at: dt.datetime
    updated_at: dt.datetime
