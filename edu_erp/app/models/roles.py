from sqlalchemy import Boolean, String, false
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base


class Role(Base):
    __tablename__ = "roles"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(40), unique=True)
    name: Mapped[str] = mapped_column(String(80))
    is_system: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())

    employee_roles = relationship("EmployeeRole", back_populates="role")
