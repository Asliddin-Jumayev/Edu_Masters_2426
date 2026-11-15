import datetime as dt
from typing import Optional
from sqlalchemy import Boolean, Date, ForeignKey, String, Text, true
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base, TimestampMixin


class Employee(TimestampMixin, Base):
    __tablename__ = "employees"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id"))
    first_name: Mapped[str] = mapped_column(String(60))
    last_name: Mapped[str] = mapped_column(String(60))
    phone: Mapped[str] = mapped_column(String(20), unique=True)
    email: Mapped[Optional[str]] = mapped_column(String(255))
    password_hash: Mapped[str] = mapped_column(String(255))
    birth_date: Mapped[Optional[dt.date]] = mapped_column(Date)
    photo_url: Mapped[Optional[str]] = mapped_column(Text)
    position: Mapped[str] = mapped_column(String(80))
    hired_at: Mapped[dt.date] = mapped_column(Date)
    fired_at: Mapped[Optional[dt.date]] = mapped_column(Date)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default=true())

    employee_roles = relationship("EmployeeRole", back_populates="employee")
