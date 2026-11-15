from pydantic import BaseModel, Field


class RefreshToken(BaseModel):
    refresh_token: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class ChangePassword(BaseModel):
    old_password: str
    new_password: str = Field(min_length=8, max_length=128)


class MyRole(BaseModel):
    role_id: int
    code: str
    branch_id: int | None


class MeResponse(BaseModel):
    id: int
    first_name: str
    last_name: str
    phone: str
    email: str | None = None
    branch_id: int
    position: str
    roles: list[MyRole]
    branch_ids: list[int] | None  # None = barcha filiallar
