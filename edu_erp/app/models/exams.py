import datetime as dt
from decimal import Decimal
from typing import Optional
from sqlalchemy import Date, DateTime, ForeignKey, Numeric, SmallInteger, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.database.base import Base
from app.models.enums import ExamType, db_enum
from app.utils.time import utcnow


class Exam(Base):
    __tablename__ = "exams"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id"))
    title: Mapped[str] = mapped_column(String(160))
    type: Mapped[ExamType] = mapped_column(db_enum(ExamType), default=ExamType.QUIZ)
    max_score: Mapped[int] = mapped_column(SmallInteger)
    passing_score: Mapped[int] = mapped_column(SmallInteger)
    held_at: Mapped[Optional[dt.datetime]] = mapped_column(DateTime)
    created_by: Mapped[Optional[int]] = mapped_column(ForeignKey("employees.id"))


class ExamResult(Base):
    __tablename__ = "exam_results"
    __table_args__ = (UniqueConstraint("exam_id", "student_id", name="uq_exam_result_student"),)
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    exam_id: Mapped[int] = mapped_column(ForeignKey("exams.id"))
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"))
    score: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    graded_by: Mapped[Optional[int]] = mapped_column(ForeignKey("employees.id"))
    graded_at: Mapped[dt.datetime] = mapped_column(DateTime, default=utcnow)


class Certificate(Base):
    __tablename__ = "certificates"
    __table_args__ = (UniqueConstraint("student_id", "group_id", name="uq_certificate_student_group"),)
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"))
    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id"))
    serial_number: Mapped[str] = mapped_column(String(40), unique=True)
    file_url: Mapped[Optional[str]] = mapped_column(Text)
    issued_at: Mapped[dt.date] = mapped_column(Date)
    issued_by: Mapped[Optional[int]] = mapped_column(ForeignKey("employees.id"))
