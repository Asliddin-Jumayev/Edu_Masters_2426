from pydantic import BaseModel
from app.schemes.common import ORM


class EmployeeRoleCreate(BaseModel):
    employee_id: int
    role_id: int
    branch_id: int | None = None  # None = barcha filiallar


class EmployeeRoleUpdate(BaseModel):
    branch_id: int | None = None


class EmployeeRoleResponse(ORM):
    id: int
    employee_id: int
    role_id: int
    branch_id: int | None
    role_code: str | None = None
