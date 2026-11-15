from decimal import Decimal
from typing import Optional
from sqlalchemy import Boolean, CheckConstraint, Numeric, SmallInteger, String, Text, true
from sqlalchemy.orm import Mapped, mapped_column
from app.database.base import Base, CreatedAtMixin


class Course(CreatedAtMixin, Base):
    __tablename__ = "courses"
    __table_args__ = (CheckConstraint("price >= 0", name="ck_courses_price"),)
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[Optional[str]] = mapped_column(Text)
    duration_months: Mapped[int] = mapped_column(SmallInteger)
    lessons_count: Mapped[int] = mapped_column(SmallInteger)
    price: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    min_age: Mapped[Optional[int]] = mapped_column(SmallInteger)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default=true())
