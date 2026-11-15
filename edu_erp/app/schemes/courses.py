import datetime as dt
from pydantic import BaseModel, Field
from app.schemes.common import ORM, PositiveMoney


class CourseCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str | None = None
    duration_months: int = Field(gt=0, le=120)
    lessons_count: int = Field(gt=0, le=2000)
    price: PositiveMoney
    min_age: int | None = Field(None, ge=0, le=100)
    is_active: bool = True


class CourseUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=120)
    description: str | None = None
    duration_months: int | None = Field(None, gt=0, le=120)
    lessons_count: int | None = Field(None, gt=0, le=2000)
    price: PositiveMoney | None = None
    min_age: int | None = Field(None, ge=0, le=100)
    is_active: bool | None = None


class CourseResponse(ORM):
    id: int
    name: str
    description: str | None
    duration_months: int
    lessons_count: int
    price: PositiveMoney
    min_age: int | None
    is_active: bool
    created_at: dt.datetime
