from typing import Optional
from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base


class EmployeeRole(Base):
    """branch_id NULL = rol barcha filiallarda amal qiladi."""
    __tablename__ = "employee_roles"
    __table_args__ = (UniqueConstraint("employee_id", "role_id", "branch_id", name="uq_employee_role_branch"),)
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id"))
    role_id: Mapped[int] = mapped_column(ForeignKey("roles.id"))
    branch_id: Mapped[Optional[int]] = mapped_column(ForeignKey("branches.id"))

    role = relationship("Role", back_populates="employee_roles")
    employee = relationship("Employee", back_populates="employee_roles")
