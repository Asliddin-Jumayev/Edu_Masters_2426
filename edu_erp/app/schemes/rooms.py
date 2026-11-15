from pydantic import BaseModel, Field
from app.schemes.common import ORM


class RoomCreate(BaseModel):
    branch_id: int
    name: str = Field(min_length=1, max_length=60)
    capacity: int = Field(gt=0, le=1000)


class RoomUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=60)
    capacity: int | None = Field(None, gt=0, le=1000)
    is_active: bool | None = None


class RoomResponse(ORM):
    id: int
    branch_id: int
    name: str
    capacity: int
    is_active: bool
