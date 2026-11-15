import datetime as dt
from decimal import Decimal
from pydantic import BaseModel, Field, model_validator
from app.models.enums import SmsStatus
from app.schemes.common import ORM, Phone


class SmsTemplateIn(BaseModel):
    code: str = Field(min_length=2, max_length=40, pattern=r"^[a-z][a-z0-9_]*$")
    body: str = Field(min_length=1)
    is_active: bool = True


class SmsTemplateResponse(ORM):
    id: int
    code: str
    body: str
    is_active: bool


class SmsSend(BaseModel):
    student_id: int | None = None
    lead_id: int | None = None
    to: str = Field("auto", pattern=r"^(auto|student|parent)$")  # student uchun qaysi raqam
    template_code: str | None = None
    body: str | None = None
    params: dict[str, str] = {}

    @model_validator(mode="after")
    def _check(self):
        if (self.student_id is None) == (self.lead_id is None):
            raise ValueError("student_id yoki lead_id dan aynan bittasi kerak")
        if not self.template_code and not self.body:
            raise ValueError("template_code yoki body kerak")
        return self


class DebtReminder(BaseModel):
    branch_id: int | None = None
    min_debt: Decimal = Decimal("0")


class SmsResponse(ORM):
    id: int
    template_id: int | None
    student_id: int | None
    lead_id: int | None
    recipient_phone: str
    body: str
    status: SmsStatus
    cost: Decimal
    sent_at: dt.datetime | None
    provider_message_id: str | None = None
    error: str | None = None
    created_at: dt.datetime


class NotificationResponse(ORM):
    id: int
    employee_id: int
    type: str
    title: str
    body: str | None
    is_read: bool
    created_at: dt.datetime


class AttachmentResponse(ORM):
    id: int
    entity_type: str
    entity_id: int
    file_name: str
    uploaded_by: int
    created_at: dt.datetime


class AuditLogResponse(ORM):
    id: int
    employee_id: int | None
    action: str
    entity_type: str
    entity_id: int | None
    old_values: dict | None
    new_values: dict | None
    created_at: dt.datetime
