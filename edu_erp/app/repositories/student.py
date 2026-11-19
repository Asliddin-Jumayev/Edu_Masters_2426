"""Student Repository va Student Service (SOLID — Repository & Service Layer Pattern).

Routerlar to'g'ridan-to'g'ri SQL so'rov yozmaydi; Service va Repository orqali ishlaydi.
"""
from typing import Sequence
from decimal import Decimal
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.students import Student
from app.models.enums import StudentStatus
from app.repositories.base import BaseRepository


class StudentRepository(BaseRepository[Student]):
    """Student modeli uchun maxsus repository."""

    def __init__(self, session: AsyncSession):
        super().__init__(Student, session)

    async def get_by_phone(self, phone: str) -> Student | None:
        stmt = select(Student).where(Student.phone == phone)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_branch(self, branch_id: int, status: StudentStatus | None = None) -> Sequence[Student]:
        stmt = select(Student).where(Student.branch_id == branch_id)
        if status:
            stmt = stmt.where(Student.status == status)
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_debtors(self, branch_id: int | None = None, limit: int = 100) -> Sequence[Student]:
        stmt = select(Student).where(Student.balance < 0)
        if branch_id is not None:
            stmt = stmt.where(Student.branch_id == branch_id)
        stmt = stmt.order_by(Student.balance.asc()).limit(limit)
        result = await self.session.execute(stmt)
        return result.scalars().all()


class StudentService:
    """Biznes mantig'i qatlami (Service Layer)."""

    def __init__(self, repo: StudentRepository):
        self.repo = repo

    async def get_student_summary(self, student_id: int) -> dict | None:
        student = await self.repo.get_by_id(student_id)
        if student is None:
            return None
        return {
            "id": student.id,
            "full_name": f"{student.first_name} {student.last_name}",
            "balance": float(student.balance or 0),
            "status": student.status.value if hasattr(student.status, "value") else str(student.status),
            "is_debtor": (student.balance or 0) < 0,
        }

    async def check_phone_unique(self, phone: str) -> bool:
        existing = await self.repo.get_by_phone(phone)
        return existing is None
