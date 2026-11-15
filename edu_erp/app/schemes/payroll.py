import datetime as dt
from decimal import Decimal
from pydantic import BaseModel, Field, model_validator
from app.models.enums import PayrollStatus, SalaryType
from app.schemes.common import ORM, Money, MonthStart


class SalaryRuleCreate(BaseModel):
    employee_id: int
    type: SalaryType
    amount: Money = Decimal("0")
    percent: Decimal | None = Field(None, gt=0, le=100, max_digits=5, decimal_places=2)
    effective_from: dt.date
    effective_to: dt.date | None = None

    @model_validator(mode="after")
    def _check(self):
        if self.type == SalaryType.PERCENT and self.percent is None:
            raise ValueError("percent turi uchun percent majburiy")
        if self.type != SalaryType.PERCENT and self.amount <= 0:
            raise ValueError("amount 0 dan katta bo'lishi kerak")
        if self.effective_to and self.effective_to < self.effective_from:
            raise ValueError("effective_to effective_from dan oldin bo'lmasligi kerak")
        return self


class SalaryRuleResponse(ORM):
    id: int
    employee_id: int
    type: SalaryType
    amount: Decimal
    percent: Decimal | None
    effective_from: dt.date
    effective_to: dt.date | None
    created_at: dt.datetime


class PayrollCalculate(BaseModel):
    period_month: MonthStart
    employee_id: int | None = None  # berilmasa: qoidasi bor hamma xodim


class PayrollAdjust(BaseModel):
    bonus: Money | None = None
    penalty: Money | None = None


class PayrollResponse(ORM):
    id: int
    employee_id: int
    period_month: dt.date
    lessons_count: int
    base_amount: Decimal
    bonus: Decimal
    penalty: Decimal
    total: Decimal
    status: PayrollStatus
    paid_at: dt.datetime | None
    approved_by: int | None
    created_at: dt.datetime
