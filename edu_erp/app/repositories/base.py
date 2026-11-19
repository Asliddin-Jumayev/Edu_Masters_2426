"""Generic Base Repository (SOLID — Single Responsibility, Dependency Inversion).

Ma'lumotlar bazasi operatsiyalarini (CRUD) biznes mantig'idan ajratadi.
Domain qatlamini ORM implementatsiyasidan mustaqil qiladi.
"""
from typing import Any, Generic, Sequence, Type, TypeVar
from pydantic import BaseModel
from sqlalchemy import select, func, delete as sa_delete
from sqlalchemy.ext.asyncio import AsyncSession

T = TypeVar("T")


class BaseRepository(Generic[T]):
    def __init__(self, model_cls: Type[T], session: AsyncSession):
        self.model_cls = model_cls
        self.session = session

    async def get_by_id(self, item_id: int) -> T | None:
        return await self.session.get(self.model_cls, item_id)

    async def list_all(self, offset: int = 0, limit: int = 100) -> Sequence[T]:
        stmt = select(self.model_cls).offset(offset).limit(limit)
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def count(self) -> int:
        stmt = select(func.count()).select_from(self.model_cls)
        return (await self.session.scalar(stmt)) or 0

    async def create(self, **kwargs: Any) -> T:
        instance = self.model_cls(**kwargs)
        self.session.add(instance)
        await self.session.flush()
        return instance

    async def update(self, item_id: int, **kwargs: Any) -> T | None:
        instance = await self.get_by_id(item_id)
        if instance is None:
            return None
        for key, value in kwargs.items():
            if hasattr(instance, key):
                setattr(instance, key, value)
        await self.session.flush()
        return instance

    async def delete(self, item_id: int) -> bool:
        instance = await self.get_by_id(item_id)
        if instance is None:
            return False
        await self.session.delete(instance)
        await self.session.flush()
        return True
