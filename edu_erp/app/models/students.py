import datetime as dt
from decimal import Decimal
from typing import Optional
from sqlalchemy import Date, ForeignKey, Numeric, SmallInteger, String, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column
from app.database.base import Base, CreatedAtMixin, TimestampMixin
from app.models.enums import EnrollmentStatus, StudentStatus, db_enum


class Student(TimestampMixin, Base):
    """balance — kesh. Haqiqat manbai: student_balance_transactions."""
    __tablename__ = "students"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id"))
    first_name: Mapped[str] = mapped_column(String(60))
    last_name: Mapped[str] = mapped_column(String(60))
    phone: Mapped[Optional[str]] = mapped_column(String(20))
    parent_phone: Mapped[Optional[str]] = mapped_column(String(20))
    birth_date: Mapped[Optional[dt.date]] = mapped_column(Date)
    source_id: Mapped[Optional[int]] = mapped_column(ForeignKey("lead_sources.id"))
    status: Mapped[StudentStatus] = mapped_column(db_enum(StudentStatus), default=StudentStatus.TRIAL)
    balance: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"), server_default=text("0"))


class Enrollment(CreatedAtMixin, Base):
    __tablename__ = "enrollments"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"))
    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id"))
    status: Mapped[EnrollmentStatus] = mapped_column(db_enum(EnrollmentStatus), default=EnrollmentStatus.ACTIVE)
    price: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    joined_at: Mapped[dt.date] = mapped_column(Date)
    left_at: Mapped[Optional[dt.date]] = mapped_column(Date)
