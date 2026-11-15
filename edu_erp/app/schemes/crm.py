import datetime as dt
from decimal import Decimal
from pydantic import BaseModel, Field, model_validator
from app.models.enums import ActivityType, TaskPriority
from app.schemes.common import ORM, Money, Phone


class LeadSourceIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    monthly_budget: Money = Decimal("0")
    is_active: bool = True


class LeadSourceResponse(ORM):
    id: int
    name: str
    monthly_budget: Decimal
    is_active: bool


class LeadStatusIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    position: int = Field(0, ge=0, le=1000)
    is_won: bool = False
    is_lost: bool = False

    @model_validator(mode="after")
    def _exclusive(self):
        if self.is_won and self.is_lost:
            raise ValueError("Bosqich bir vaqtda is_won va is_lost bo'la olmaydi")
        return self


class LeadStatusResponse(ORM):
    id: int
    name: str
    position: int
    is_won: bool
    is_lost: bool


class LeadCreate(BaseModel):
    branch_id: int
    first_name: str = Field(min_length=1, max_length=60)
    last_name: str | None = Field(None, max_length=60)
    phone: Phone
    source_id: int | None = None
    status_id: int | None = None  # berilmasa: eng birinchi bosqich
    course_id: int | None = None
    assigned_to: int | None = None
    comment: str | None = None


class LeadUpdate(BaseModel):
    first_name: str | None = Field(None, min_length=1, max_length=60)
    last_name: str | None = Field(None, max_length=60)
    phone: Phone | None = None
    source_id: int | None = None
    course_id: int | None = None
    assigned_to: int | None = None
    comment: str | None = None


class LeadStatusChange(BaseModel):
    status_id: int
    lost_reason: str | None = Field(None, max_length=200)


class LeadResponse(ORM):
    id: int
    branch_id: int
    first_name: str
    last_name: str | None
    phone: str
    source_id: int | None
    status_id: int
    course_id: int | None
    assigned_to: int | None
    lost_reason: str | None
    student_id: int | None
    comment: str | None
    created_by: int | None
    created_at: dt.datetime
    updated_at: dt.datetime


class LeadConvert(BaseModel):
    last_name: str | None = Field(None, max_length=60)
    parent_phone: Phone | None = None
    birth_date: dt.date | None = None
    group_id: int | None = None  # berilsa darhol guruhga yoziladi
    price: Money | None = None


class ActivityCreate(BaseModel):
    type: ActivityType
    result: str | None = Field(None, max_length=120)
    note: str | None = None


class ActivityResponse(ORM):
    id: int
    lead_id: int
    employee_id: int
    type: ActivityType
    result: str | None
    note: str | None
    created_at: dt.datetime


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    lead_id: int | None = None
    student_id: int | None = None
    assigned_to: int | None = None  # berilmasa: o'zi
    priority: TaskPriority = TaskPriority.MEDIUM
    due_at: dt.datetime | None = None

    @model_validator(mode="after")
    def _target(self):
        if self.lead_id is None and self.student_id is None:
            raise ValueError("lead_id yoki student_id dan biri kerak")
        return self


class TaskUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=160)
    assigned_to: int | None = None
    priority: TaskPriority | None = None
    due_at: dt.datetime | None = None


class TaskResponse(ORM):
    id: int
    title: str
    lead_id: int | None
    student_id: int | None
    assigned_to: int
    priority: TaskPriority
    due_at: dt.datetime | None
    completed_at: dt.datetime | None
    created_by: int | None
    created_at: dt.datetime


class TrialCreate(BaseModel):
    lead_id: int
    group_id: int
    scheduled_at: dt.datetime


class TrialResult(BaseModel):
    attended: bool
    feedback: str | None = None


class TrialResponse(ORM):
    id: int
    lead_id: int
    group_id: int
    scheduled_at: dt.datetime
    attended: bool | None
    feedback: str | None
    created_at: dt.datetime
