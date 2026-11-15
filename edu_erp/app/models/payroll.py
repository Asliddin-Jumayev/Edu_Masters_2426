import datetime as dt
from decimal import Decimal
from typing import Optional
from sqlalchemy import Date, DateTime, ForeignKey, Numeric, SmallInteger, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column
from app.database.base import Base, CreatedAtMixin
from app.models.enums import PayrollStatus, SalaryType, db_enum

Money = Numeric(14, 2)


class SalaryRule(CreatedAtMixin, Base):
    __tablename__ = "salary_rules"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id"))
    type: Mapped[SalaryType] = mapped_column(db_enum(SalaryType))
    amount: Mapped[Decimal] = mapped_column(Money, default=Decimal("0"), server_default=text("0"))
    percent: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2))
    effective_from: Mapped[dt.date] = mapped_column(Date)
    effective_to: Mapped[Optional[dt.date]] = mapped_column(Date)


class Payroll(CreatedAtMixin, Base):
    __tablename__ = "payrolls"
    __table_args__ = (UniqueConstraint("employee_id", "period_month", name="uq_payroll_employee_month"),)
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id"))
    period_month: Mapped[dt.date] = mapped_column(Date)
    lessons_count: Mapped[int] = mapped_column(SmallInteger, default=0, server_default=text("0"))
    base_amount: Mapped[Decimal] = mapped_column(Money, default=Decimal("0"), server_default=text("0"))
    bonus: Mapped[Decimal] = mapped_column(Money, default=Decimal("0"), server_default=text("0"))
    penalty: Mapped[Decimal] = mapped_column(Money, default=Decimal("0"), server_default=text("0"))
    total: Mapped[Decimal] = mapped_column(Money, default=Decimal("0"), server_default=text("0"))
    status: Mapped[PayrollStatus] = mapped_column(db_enum(PayrollStatus), default=PayrollStatus.DRAFT)
    paid_at: Mapped[Optional[dt.datetime]] = mapped_column(DateTime)
    approved_by: Mapped[Optional[int]] = mapped_column(ForeignKey("employees.id"))
