import datetime as dt
from typing import Optional
from sqlalchemy import DateTime, Date, ForeignKey, SmallInteger, String, Text, Time, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.database.base import Base, CreatedAtMixin
from app.models.enums import AttendanceStatus, SessionStatus, db_enum
from app.utils.time import utcnow


class GroupSchedule(Base):
    __tablename__ = "group_schedules"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id"))
    weekday: Mapped[int] = mapped_column(SmallInteger)  # 1=dushanba ... 7=yakshanba
    start_time: Mapped[dt.time] = mapped_column(Time)
    end_time: Mapped[dt.time] = mapped_column(Time)
    room_id: Mapped[Optional[int]] = mapped_column(ForeignKey("rooms.id"))


class LessonSession(CreatedAtMixin, Base):
    __tablename__ = "lesson_sessions"
    __table_args__ = (UniqueConstraint("group_id", "date", "start_time", name="uq_session_group_date_start"),)
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id"))
    topic: Mapped[Optional[str]] = mapped_column(String(200))
    teacher_id: Mapped[Optional[int]] = mapped_column(ForeignKey("employees.id"))
    room_id: Mapped[Optional[int]] = mapped_column(ForeignKey("rooms.id"))
    date: Mapped[dt.date] = mapped_column(Date)
    start_time: Mapped[dt.time] = mapped_column(Time)
    end_time: Mapped[dt.time] = mapped_column(Time)
    status: Mapped[SessionStatus] = mapped_column(db_enum(SessionStatus), default=SessionStatus.PLANNED)
    note: Mapped[Optional[str]] = mapped_column(Text)


class Attendance(Base):
    __tablename__ = "attendances"
    __table_args__ = (UniqueConstraint("session_id", "student_id", name="uq_attendance_session_student"),)
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("lesson_sessions.id"))
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"))
    status: Mapped[AttendanceStatus] = mapped_column(db_enum(AttendanceStatus))
    note: Mapped[Optional[str]] = mapped_column(String(255))
    marked_by: Mapped[Optional[int]] = mapped_column(ForeignKey("employees.id"))
    marked_at: Mapped[dt.datetime] = mapped_column(DateTime, default=utcnow)
