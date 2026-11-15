import datetime as dt
from decimal import Decimal
from typing import Optional
from sqlalchemy import (Boolean, CheckConstraint, Date, DateTime, ForeignKey, Index, Numeric,
                        String, Text, UniqueConstraint, false, text)
from sqlalchemy.orm import Mapped, mapped_column
from app.database.base import Base, CreatedAtMixin
from app.models.enums import (BalanceTxnType, DiscountType, InvoiceStatus, PaymentStatus, db_enum)
from app.utils.time import utcnow

Money = Numeric(14, 2)


class PaymentMethod(Base):
    __tablename__ = "payment_methods"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(30), unique=True)
    name: Mapped[str] = mapped_column(String(60))
    is_online: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())


class Invoice(CreatedAtMixin, Base):
    __tablename__ = "invoices"
    __table_args__ = (
        UniqueConstraint("enrollment_id", "period_month", name="uq_invoice_enrollment_month"),
        CheckConstraint("total >= 0", name="ck_invoices_total"),
    )
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"))
    enrollment_id: Mapped[Optional[int]] = mapped_column(ForeignKey("enrollments.id"))
    period_month: Mapped[dt.date] = mapped_column(Date)  # oyning 1-sanasi
    amount: Mapped[Decimal] = mapped_column(Money)
    discount_amount: Mapped[Decimal] = mapped_column(Money, default=Decimal("0"), server_default=text("0"))
    total: Mapped[Decimal] = mapped_column(Money)
    paid_amount: Mapped[Decimal] = mapped_column(Money, default=Decimal("0"), server_default=text("0"))
    status: Mapped[InvoiceStatus] = mapped_column(db_enum(InvoiceStatus), default=InvoiceStatus.UNPAID)
    due_date: Mapped[dt.date] = mapped_column(Date)


class Payment(Base):
    __tablename__ = "payments"
    __table_args__ = (
        UniqueConstraint("method_id", "transaction_id", name="uq_payment_method_txn"),
        CheckConstraint("amount > 0", name="ck_payments_amount"),
    )
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"))
    invoice_id: Mapped[Optional[int]] = mapped_column(ForeignKey("invoices.id"))
    method_id: Mapped[int] = mapped_column(ForeignKey("payment_methods.id"))
    amount: Mapped[Decimal] = mapped_column(Money)
    transaction_id: Mapped[Optional[str]] = mapped_column(String(120))
    paid_at: Mapped[dt.datetime] = mapped_column(DateTime, default=utcnow)
    received_by: Mapped[Optional[int]] = mapped_column(ForeignKey("employees.id"))
    is_refunded: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())
    status: Mapped[PaymentStatus] = mapped_column(db_enum(PaymentStatus), default=PaymentStatus.COMPLETED)  # yangi
    refunded_at: Mapped[Optional[dt.datetime]] = mapped_column(DateTime)                                    # yangi
    note: Mapped[Optional[str]] = mapped_column(Text)


class Discount(CreatedAtMixin, Base):
    __tablename__ = "discounts"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"))
    enrollment_id: Mapped[Optional[int]] = mapped_column(ForeignKey("enrollments.id"))
    type: Mapped[DiscountType] = mapped_column(db_enum(DiscountType))
    value: Mapped[Decimal] = mapped_column(Money)
    reason: Mapped[Optional[str]] = mapped_column(String(200))
    valid_from: Mapped[dt.date] = mapped_column(Date)
    valid_to: Mapped[Optional[dt.date]] = mapped_column(Date)
    created_by: Mapped[Optional[int]] = mapped_column(ForeignKey("employees.id"))


class StudentBalanceTransaction(CreatedAtMixin, Base):
    """Faqat INSERT. UPDATE/DELETE qilinmaydi."""
    __tablename__ = "student_balance_transactions"
    __table_args__ = (Index("ix_sbt_student_created", "student_id", "created_at"),)
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"))
    type: Mapped[BalanceTxnType] = mapped_column(db_enum(BalanceTxnType))
    amount: Mapped[Decimal] = mapped_column(Money)
    balance_after: Mapped[Decimal] = mapped_column(Money)
    reference_type: Mapped[Optional[str]] = mapped_column(String(40))
    reference_id: Mapped[Optional[int]]
    created_by: Mapped[Optional[int]] = mapped_column(ForeignKey("employees.id"))


class ExpenseCategory(Base):
    __tablename__ = "expense_categories"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(80), unique=True)


class Expense(CreatedAtMixin, Base):
    __tablename__ = "expenses"
    __table_args__ = (CheckConstraint("amount > 0", name="ck_expenses_amount"),)
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id"))
    category_id: Mapped[int] = mapped_column(ForeignKey("expense_categories.id"))
    amount: Mapped[Decimal] = mapped_column(Money)
    description: Mapped[Optional[str]] = mapped_column(Text)
    spent_at: Mapped[dt.date] = mapped_column(Date)
    receipt_url: Mapped[Optional[str]] = mapped_column(Text)
    created_by: Mapped[Optional[int]] = mapped_column(ForeignKey("employees.id"))
