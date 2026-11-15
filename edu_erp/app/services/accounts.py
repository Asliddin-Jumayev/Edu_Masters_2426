from sqlalchemy import func, select
from app.models.employee_roles import EmployeeRole
from app.models.employees import Employee
from app.models.roles import Role
from app.utils.roles import ADMIN


async def active_admin_count(db) -> int:
    return await db.scalar(
        select(func.count(func.distinct(Employee.id)))
        .join(EmployeeRole, EmployeeRole.employee_id == Employee.id)
        .join(Role, Role.id == EmployeeRole.role_id)
        .where(Role.code == ADMIN, Employee.is_active.is_(True))) or 0


async def employee_has_role(db, employee_id: int, code: str) -> bool:
    return await db.scalar(
        select(EmployeeRole.id).join(Role, Role.id == EmployeeRole.role_id)
        .where(EmployeeRole.employee_id == employee_id, Role.code == code).limit(1)) is not None
