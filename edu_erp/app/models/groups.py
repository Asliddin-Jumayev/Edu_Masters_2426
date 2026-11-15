import datetime as dt
from decimal import Decimal
from typing import Optional
from sqlalchemy import CheckConstraint, Date, ForeignKey, Numeric, SmallInteger, String, text
from sqlalchemy.orm import Mapped, mapped_column
from app.database.base import Base, CreatedAtMixin
from app.models.enums import GroupStatus, db_enum


class Group(CreatedAtMixin, Base):
    __tablename__ = "groups"
    __table_args__ = (CheckConstraint("max_students > 0", name="ck_groups_max_students"),)
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id"))
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id"))
    name: Mapped[str] = mapped_column(String(80))
    teacher_id: Mapped[Optional[int]] = mapped_column(ForeignKey("employees.id"))
    room_id: Mapped[Optional[int]] = mapped_column(ForeignKey("rooms.id"))
    status: Mapped[GroupStatus] = mapped_column(db_enum(GroupStatus), default=GroupStatus.PLANNED)
    start_date: Mapped[Optional[dt.date]] = mapped_column(Date)
    end_date: Mapped[Optional[dt.date]] = mapped_column(Date)
    max_students: Mapped[int] = mapped_column(SmallInteger)
    current_students: Mapped[int] = mapped_column(SmallInteger, default=0, server_default=text("0"))
    price: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 2))
