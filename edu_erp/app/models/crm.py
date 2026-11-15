import datetime as dt
from decimal import Decimal
from typing import Optional
from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, SmallInteger, String, Text, UniqueConstraint, false, text, true
from sqlalchemy.orm import Mapped, mapped_column
from app.database.base import Base, CreatedAtMixin, TimestampMixin
from app.models.enums import ActivityType, TaskPriority, db_enum


class LeadSource(Base):
    __tablename__ = "lead_sources"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(80))
    monthly_budget: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"), server_default=text("0"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default=true())


class LeadStatus(Base):
    __tablename__ = "lead_statuses"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(60))
    position: Mapped[int] = mapped_column(SmallInteger, default=0)
    is_won: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())
    is_lost: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())


class Lead(TimestampMixin, Base):
    """Konversiya: leads.student_id orqali. (students.lead_id olib tashlangan — aylana bog'lanish bo'lmasin.)"""
    __tablename__ = "leads"
    __table_args__ = (UniqueConstraint("branch_id", "phone", name="uq_leads_branch_phone"),)
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id"))
    first_name: Mapped[str] = mapped_column(String(60))
    last_name: Mapped[Optional[str]] = mapped_column(String(60))
    phone: Mapped[str] = mapped_column(String(20))
    source_id: Mapped[Optional[int]] = mapped_column(ForeignKey("lead_sources.id"))
    status_id: Mapped[int] = mapped_column(ForeignKey("lead_statuses.id"))
    course_id: Mapped[Optional[int]] = mapped_column(ForeignKey("courses.id"))
    assigned_to: Mapped[Optional[int]] = mapped_column(ForeignKey("employees.id"))
    lost_reason: Mapped[Optional[str]] = mapped_column(String(200))
    student_id: Mapped[Optional[int]] = mapped_column(ForeignKey("students.id"))
    comment: Mapped[Optional[str]] = mapped_column(Text)
    created_by: Mapped[Optional[int]] = mapped_column(ForeignKey("employees.id"))


class LeadActivity(CreatedAtMixin, Base):
    __tablename__ = "lead_activities"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    lead_id: Mapped[int] = mapped_column(ForeignKey("leads.id"))
    employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id"))
    type: Mapped[ActivityType] = mapped_column(db_enum(ActivityType))
    result: Mapped[Optional[str]] = mapped_column(String(120))
    note: Mapped[Optional[str]] = mapped_column(Text)


class Task(CreatedAtMixin, Base):
    __tablename__ = "tasks"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(160))
    lead_id: Mapped[Optional[int]] = mapped_column(ForeignKey("leads.id"))
    student_id: Mapped[Optional[int]] = mapped_column(ForeignKey("students.id"))
    assigned_to: Mapped[int] = mapped_column(ForeignKey("employees.id"))
    priority: Mapped[TaskPriority] = mapped_column(db_enum(TaskPriority), default=TaskPriority.MEDIUM)
    due_at: Mapped[Optional[dt.datetime]] = mapped_column(DateTime)
    completed_at: Mapped[Optional[dt.datetime]] = mapped_column(DateTime)
    created_by: Mapped[Optional[int]] = mapped_column(ForeignKey("employees.id"))


class TrialLesson(CreatedAtMixin, Base):
    __tablename__ = "trial_lessons"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    lead_id: Mapped[int] = mapped_column(ForeignKey("leads.id"))
    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id"))
    scheduled_at: Mapped[dt.datetime] = mapped_column(DateTime)
    attended: Mapped[Optional[bool]] = mapped_column(Boolean)  # NULL = hali bo'lmagan
    feedback: Mapped[Optional[str]] = mapped_column(Text)
