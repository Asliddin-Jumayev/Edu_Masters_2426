from typing import Optional
from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.database.base import Base


class TeacherProfile(Base):
    __tablename__ = "teacher_profiles"
    employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id", ondelete="CASCADE"), primary_key=True)
    bio: Mapped[Optional[str]] = mapped_column(Text)
    specialization: Mapped[Optional[str]] = mapped_column(String(255))
    experience_years: Mapped[int] = mapped_column(default=0)
    max_groups: Mapped[int] = mapped_column(default=5)  # bir vaqtda nechta guruh (0 emas!)
