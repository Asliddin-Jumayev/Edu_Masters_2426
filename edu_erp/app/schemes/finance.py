import datetime as dt
from decimal import Decimal
from pydantic import BaseModel, Field, model_validator
from app.models.enums import DiscountType, InvoiceStatus, PaymentStatus
from app.schemes.common import ORM, Money, MonthStart, PositiveMoney


class PaymentMethodIn(BaseModel):
    code: str = Field(min_length=2, max_length=30, pattern=r"^[a-z][a-z0-9_]*$")
    name: str = Field(min_length=1, max_length=60)
    is_online: bool = False


class PaymentMethodResponse(ORM):
    id: int
    code: str
    name: str
    is_online: bool


class InvoiceCreate(BaseModel):  # qo'lda hisob yozish
    student_id: int
    enrollment_id: int | None = None
    period_month: MonthStart
    amount: PositiveMoney
    discount_amount: Money = Decimal("0")
    due_date: dt.date | None = None

    @model_validator(mode="after")
    def _disc(self):
        if self.discount_amount > self.amount:
            raise ValueError("Chegirma summadan oshib ketdi")
        return self


class InvoiceGenerate(BaseModel):
    period_month: MonthStart
    group_id: int | None = None
    branch_id: int | None = None
    student_id: int | None = None


class InvoiceGenerateResult(BaseModel):
    created: int
    skipped_existing: int


class InvoiceCancel(BaseModel):
    reason: str = Field(min_length=3, max_length=200)


class InvoiceResponse(ORM):
    id: int
    student_id: int
    enrollment_id: int | None
    period_month: dt.date
    amount: Decimal
    discount_amount: Decimal
    total: Decimal
    paid_amount: Decimal
    status: InvoiceStatus
    due_date: dt.date
    created_at: dt.datetime


class PaymentCreate(BaseModel):
    student_id: int
    invoice_id: int | None = None
    method_id: int
    amount: PositiveMoney
    transaction_id: str | None = Field(None, max_length=120)
    paid_at: dt.datetime | None = None
    note: str | None = None
    status: PaymentStatus = PaymentStatus.COMPLETED


class PaymentResponse(ORM):
    id: int
    student_id: int
    invoice_id: int | None
    method_id: int
    amount: Decimal
    transaction_id: str | None
    paid_at: dt.datetime
    received_by: int | None
    is_refunded: bool
    status: PaymentStatus
    refunded_at: dt.datetime | None
    note: str | None


class DiscountCreate(BaseModel):
    student_id: int
    enrollment_id: int | None = None
    type: DiscountType
    value: PositiveMoney
    reason: str | None = Field(None, max_length=200)
    valid_from: dt.date | None = None
    valid_to: dt.date | None = None

    @model_validator(mode="after")
    def _check(self):
        if self.type == DiscountType.PERCENT and self.value > 100:
            raise ValueError("Foiz 100 dan oshmasligi kerak")
        if self.valid_from and self.valid_to and self.valid_to < self.valid_from:
            raise ValueError("valid_to valid_from dan oldin bo'lmasligi kerak")
        return self


class DiscountUpdate(BaseModel):
    value: PositiveMoney | None = None
    reason: str | None = Field(None, max_length=200)
    valid_to: dt.date | None = None


class DiscountResponse(ORM):
    id: int
    student_id: int
    enrollment_id: int | None
    type: DiscountType
    value: Decimal
    reason: str | None
    valid_from: dt.date
    valid_to: dt.date | None
    created_by: int | None
    created_at: dt.datetime


class ExpenseCategoryIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)


class ExpenseCategoryResponse(ORM):
    id: int
    name: str


class ExpenseCreate(BaseModel):
    branch_id: int
    category_id: int
    amount: PositiveMoney
    description: str | None = None
    spent_at: dt.date
    receipt_url: str | None = None


class ExpenseUpdate(BaseModel):
    category_id: int | None = None
    amount: PositiveMoney | None = None
    description: str | None = None
    spent_at: dt.date | None = None
    receipt_url: str | None = None


class ExpenseResponse(ORM):
    id: int
    branch_id: int
    category_id: int
    amount: Decimal
    description: str | None
    spent_at: dt.date
    receipt_url: str | None
    created_by: int | None
    created_at: dt.datetime
