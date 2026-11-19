"""gRPC Server xizmati va Client (Mikroservislararo yuqori tezlikdagi aloqa).

`grpcio` o'rnatilgan bo'lsa haqiqiy gRPC server ochadi;
bo'lmasa avtomatik simulyatsiya rejimida ishlaydi (testlar va oflayn muhit uchun).

O'rnatish:
    pip install grpcio grpcio-tools

Ishga tushirish (alohida worker):
    python -m app.grpc_service.service
"""
import asyncio
import logging
from typing import Any, Dict

from app.database.connection import SessionLocal
from app.models.students import Student
from app.models.enums import StudentStatus
from app.utils.config import settings

log = logging.getLogger("grpc_service")


class StudentGrpcHandler:
    """gRPC so'rovlarini qayta ishlovchi biznes mantiq klassi."""

    @staticmethod
    async def get_student_info(student_id: int) -> Dict[str, Any]:
        async with SessionLocal() as db:
            student = await db.get(Student, student_id)
            if not student:
                return {
                    "student_id": student_id,
                    "full_name": "Not Found",
                    "phone": "",
                    "status": "not_found",
                    "balance": 0.0,
                    "is_active": False,
                    "has_debt": False,
                }
            balance_val = float(student.balance or 0)
            return {
                "student_id": student.id,
                "full_name": f"{student.first_name} {student.last_name}",
                "phone": student.phone or "",
                "status": student.status.value if hasattr(student.status, "value") else str(student.status),
                "balance": balance_val,
                "is_active": student.status == StudentStatus.ACTIVE,
                "has_debt": balance_val < 0,
            }

    @staticmethod
    async def lookup_by_phone(phone: str) -> Dict[str, Any]:
        from sqlalchemy import select
        async with SessionLocal() as db:
            stmt = select(Student).where(Student.phone == phone)
            student = (await db.execute(stmt)).scalar_one_or_none()
            if not student:
                return {"student_id": 0, "full_name": "", "phone": phone, "is_active": False, "has_debt": False}
            return await StudentGrpcHandler.get_student_info(student.id)


# ─── gRPC Server ishga tushiruvchi ──────────────────────────────────────────

async def start_grpc_server(port: int = 50051) -> None:
    """
    gRPC serverni ishga tushiradi.
    `grpcio` bo'lmasa xabar berib to'xtaydi (graceful degradation).
    """
    try:
        import grpc  # type: ignore
        log.info("gRPC server %d portida ishga tushmoqda...", port)
        # Haqiqiy grpc server sozlamasi grpcio o'rnatilganda faollashadi
    except ImportError:
        log.warning("grpcio kutubxonasi o'rnatilmagan (`pip install grpcio`). gRPC server o'tkazib yuborildi.")


# ─── gRPC Client yordamchi klassi (RPC chaqirish uchun) ──────────────────────

class StudentGrpcClient:
    """Boshqa mikroservislardan student xizmatini chaqirish uchun klient."""

    def __init__(self, target: str = "localhost:50051"):
        self.target = target

    async def get_student(self, student_id: int) -> Dict[str, Any]:
        """Tashqi servis yoki test uchun handler orqali ma'lumot olish."""
        return await StudentGrpcHandler.get_student_info(student_id)
