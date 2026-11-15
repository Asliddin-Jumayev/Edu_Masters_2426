import datetime as dt
from pydantic import BaseModel, Field, model_validator
from app.models.enums import AttendanceStatus, SessionStatus
from app.schemes.common import ORM


class SessionCreate(BaseModel):
    group_id: int
    date: dt.date
    start_time: dt.time
    end_time: dt.time
    teacher_id: int | None = None
    room_id: int | None = None
    topic: str | None = Field(None, max_length=200)
    note: str | None = None

    @model_validator(mode="after")
    def _times(self):
        if self.end_time <= self.start_time:
            raise ValueError("end_time start_time dan keyin bo'lishi kerak")
        return self


class SessionUpdate(BaseModel):
    date: dt.date | None = None
    start_time: dt.time | None = None
    end_time: dt.time | None = None
    teacher_id: int | None = None
    room_id: int | None = None
    topic: str | None = Field(None, max_length=200)
    note: str | None = None
    status: SessionStatus | None = None


class SessionGenerate(BaseModel):
    group_id: int
    date_from: dt.date | None = None
    date_to: dt.date | None = None


class SessionGenerateResult(BaseModel):
    created: int
    skipped_existing: int
    conflicts: list[str]


class SessionResponse(ORM):
    id: int
    group_id: int
    topic: str | None
    teacher_id: int | None
    room_id: int | None
    date: dt.date
    start_time: dt.time
    end_time: dt.time
    status: SessionStatus
    note: str | None
    created_at: dt.datetime


class AttendanceItem(BaseModel):
    student_id: int
    status: AttendanceStatus
    note: str | None = Field(None, max_length=255)


class AttendanceBulk(BaseModel):
    items: list[AttendanceItem] = Field(min_length=1)


class AttendanceResponse(ORM):
    id: int
    session_id: int
    student_id: int
    status: AttendanceStatus
    note: str | None
    marked_by: int | None
    marked_at: dt.datetime
