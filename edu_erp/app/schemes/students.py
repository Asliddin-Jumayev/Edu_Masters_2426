import datetime as dt
from decimal import Decimal
from pydantic import BaseModel, Field, model_validator
from app.models.enums import BalanceTxnType, EnrollmentStatus, StudentStatus
from app.schemes.common import ORM, Phone, PositiveMoney


class StudentCreate(BaseModel):
    branch_id: int
    first_name: str = Field(min_length=1, max_length=60)
    last_name: str = Field(min_length=1, max_length=60)
    phone: Phone | None = None
    parent_phone: Phone | None = None
    birth_date: dt.date | None = None
    source_id: int | None = None
    status: StudentStatus = StudentStatus.TRIAL

    @model_validator(mode="after")
    def _need_phone(self):
        if not self.phone and not self.parent_phone:
            raise ValueError("phone yoki parent_phone dan kamida bittasi kerak")
        return self


class StudentUpdate(BaseModel):
    first_name: str | None = Field(None, min_length=1, max_length=60)
    last_name: str | None = Field(None, min_length=1, max_length=60)
    phone: Phone | None = None
    parent_phone: Phone | None = None
    birth_date: dt.date | None = None
    source_id: int | None = None
    status: StudentStatus | None = None


class StudentResponse(ORM):
    id: int
    branch_id: int
    first_name: str
    last_name: str
    phone: str | None
    parent_phone: str | None
    birth_date: dt.date | None
    source_id: int | None
    status: StudentStatus
    balance: Decimal
    created_at: dt.datetime
    updated_at: dt.datetime


class BalanceAdjust(BaseModel):
    amount: Decimal = Field(max_digits=14, decimal_places=2)  # musbat yoki manfiy
    reason: str = Field(min_length=3, max_length=200)

    @model_validator(mode="after")
    def _nonzero(self):
        if self.amount == 0:
            raise ValueError("amount 0 bo'lmasligi kerak")
        return self


class BalanceTxnResponse(ORM):
    id: int
    student_id: int
    type: BalanceTxnType
    amount: Decimal
    balance_after: Decimal
    reference_type: str | None
    reference_id: int | None
    created_by: int | None
    created_at: dt.datetime


class EnrollmentCreate(BaseModel):
    student_id: int
    group_id: int
    price: PositiveMoney | None = None  # berilmasa: group.price yoki course.price
    joined_at: dt.date | None = None


class EnrollmentStatusChange(BaseModel):
    status: EnrollmentStatus
    left_at: dt.date | None = None


class EnrollmentPriceChange(BaseModel):
    price: PositiveMoney


class EnrollmentResponse(ORM):
    id: int
    student_id: int
    group_id: int
    status: EnrollmentStatus
    price: Decimal
    joined_at: dt.date
    left_at: dt.date | None
    created_at: dt.datetime
