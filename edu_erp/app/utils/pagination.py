from typing import Annotated, Generic, TypeVar
from fastapi import Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, select

T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    limit: int
    offset: int


class PageParams:
    def __init__(self, limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0)):
        self.limit = limit
        self.offset = offset


Pagination = Annotated[PageParams, Depends()]


async def paginate(db, stmt, params: PageParams) -> dict:
    total = await db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery()))
    rows = (await db.execute(stmt.limit(params.limit).offset(params.offset))).scalars().all()
    return {"items": rows, "total": total or 0, "limit": params.limit, "offset": params.offset}
