import datetime as dt
from pydantic import BaseModel, Field
from app.schemes.common import ORM, Phone


class BranchCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    code: str = Field(min_length=1, max_length=20, pattern=r"^[A-Za-z0-9_-]+$")
    address: str
    phone: Phone
    city: str = Field(max_length=60)
    opened_at: dt.date


class BranchUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=120)
    code: str | None = Field(None, min_length=1, max_length=20, pattern=r"^[A-Za-z0-9_-]+$")
    address: str | None = None
    phone: Phone | None = None
    city: str | None = Field(None, max_length=60)
    opened_at: dt.date | None = None


class BranchResponse(ORM):
    id: int
    name: str
    code: str
    address: str
    phone: str
    city: str
    is_active: bool
    opened_at: dt.date
    created_at: dt.datetime
