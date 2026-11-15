from pydantic import BaseModel, Field
from app.schemes.common import ORM


class RoleCreate(BaseModel):
    code: str = Field(min_length=2, max_length=40, pattern=r"^[a-z][a-z0-9_]*$")
    name: str = Field(min_length=1, max_length=80)


class RoleUpdate(BaseModel):
    code: str | None = Field(None, min_length=2, max_length=40, pattern=r"^[a-z][a-z0-9_]*$")
    name: str | None = Field(None, min_length=1, max_length=80)


class RoleResponse(ORM):
    id: int
    code: str
    name: str
    is_system: bool
