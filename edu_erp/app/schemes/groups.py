import datetime as dt
from decimal import Decimal
from pydantic import BaseModel, Field
from app.models.enums import GroupStatus
from app.schemes.common import ORM, PositiveMoney


class GroupCreate(BaseModel):
    branch_id: int
    course_id: int
    name: str = Field(min_length=1, max_length=80)
    teacher_id: int | None = None
    room_id: int | None = None
    status: GroupStatus = GroupStatus.PLANNED
    start_date: dt.date | None = None
    end_date: dt.date | None = None
    max_students: int = Field(gt=0, le=500)
    price: PositiveMoney | None = None


class GroupUpdate(BaseModel):
    course_id: int | None = None
    name: str | None = Field(None, min_length=1, max_length=80)
    teacher_id: int | None = None
    room_id: int | None = None
    status: GroupStatus | None = None
    start_date: dt.date | None = None
    end_date: dt.date | None = None
    max_students: int | None = Field(None, gt=0, le=500)
    price: PositiveMoney | None = None


class GroupResponse(ORM):
    id: int
    branch_id: int
    course_id: int
    name: str
    teacher_id: int | None
    room_id: int | None
    status: GroupStatus
    start_date: dt.date | None
    end_date: dt.date | None
    max_students: int
    current_students: int
    price: Decimal | None
    created_at: dt.datetime


class ScheduleCreate(BaseModel):
    weekday: int = Field(ge=1, le=7)
    start_time: dt.time
    end_time: dt.time
    room_id: int | None = None


class ScheduleUpdate(BaseModel):
    weekday: int | None = Field(None, ge=1, le=7)
    start_time: dt.time | None = None
    end_time: dt.time | None = None
    room_id: int | None = None


class ScheduleResponse(ORM):
    id: int
    group_id: int
    weekday: int
    start_time: dt.time
    end_time: dt.time
    room_id: int | None
