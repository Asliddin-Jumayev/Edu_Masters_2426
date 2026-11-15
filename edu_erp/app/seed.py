"""Boshlang'ich ma'lumotlar. Ishga tushirish:  python -m app.seed
Admin telefoni/paroli .env dagi ADMIN_PHONE / ADMIN_PASSWORD dan olinadi (yoki so'raladi)."""
import asyncio
import datetime as dt
import getpass
from sqlalchemy import func, select
import app.models  # noqa: F401
from app.database.connection import SessionLocal
from app.models.branches import Branch
from app.models.communication import SmsTemplate
from app.models.crm import LeadStatus
from app.models.employee_roles import EmployeeRole
from app.models.employees import Employee
from app.models.finance import ExpenseCategory, PaymentMethod
from app.models.roles import Role
from app.schemes.common import normalize_phone
from app.utils.config import settings
from app.utils.security import get_password_hash

ROLES = [("admin", "Administrator"), ("manager", "Menejer"), ("teacher", "O'qituvchi"), ("accountant", "Buxgalter")]
LEAD_STATUSES = [("Yangi", 1, False, False), ("Bog'lanildi", 2, False, False),
                 ("Sinov darsiga yozildi", 3, False, False), ("Sinovga keldi", 4, False, False),
                 ("Yozildi", 5, True, False), ("Yo'qotildi", 6, False, True)]
METHODS = [("cash", "Naqd", False), ("card", "Plastik karta", False), ("transfer", "Bank o'tkazmasi", False),
           ("click", "Click", True), ("payme", "Payme", True)]
SMS = [("payment_reminder", "Hurmatli {name}, o'quv to'lovi bo'yicha qarzdorligingiz {debt} so'm. Iltimos, to'lovni amalga oshiring."),
       ("absence_alert", "Hurmatli ota-ona, {name} bugungi darsga kelmadi."),
       ("lesson_reminder", "{name}, ertaga soat {time} da darsingiz bor.")]
CATEGORIES = ["Ijara", "Kommunal", "Marketing", "Jihozlar", "Boshqa"]


async def seed_all(db, admin_phone: str | None = None, admin_password: str | None = None) -> dict:
    created = {}
    existing = set((await db.execute(select(Role.code))).scalars().all())
    for code, name in ROLES:
        if code not in existing:
            db.add(Role(code=code, name=name, is_system=True))
    if not await db.scalar(select(func.count(LeadStatus.id))):
        for n, pos, won, lost in LEAD_STATUSES:
            db.add(LeadStatus(name=n, position=pos, is_won=won, is_lost=lost))
    have = set((await db.execute(select(PaymentMethod.code))).scalars().all())
    for code, name, online in METHODS:
        if code not in have:
            db.add(PaymentMethod(code=code, name=name, is_online=online))
    have = set((await db.execute(select(SmsTemplate.code))).scalars().all())
    for code, body in SMS:
        if code not in have:
            db.add(SmsTemplate(code=code, body=body))
    have = set((await db.execute(select(ExpenseCategory.name))).scalars().all())
    for name in CATEGORIES:
        if name not in have:
            db.add(ExpenseCategory(name=name))
    await db.flush()

    branch = await db.scalar(select(Branch).order_by(Branch.id).limit(1))
    if branch is None:
        branch = Branch(name="Asosiy filial", code="MAIN", address="-", phone="+998000000000", city="Toshkent",
                        opened_at=dt.date.today())
        db.add(branch)
        await db.flush()
        created["branch"] = branch.code

    if admin_phone and admin_password:
        phone = normalize_phone(admin_phone)
        if not await db.scalar(select(Employee.id).where(Employee.phone == phone)):
            emp = Employee(branch_id=branch.id, first_name="Admin", last_name="Admin", phone=phone,
                           password_hash=await get_password_hash(admin_password), position="Administrator",
                           hired_at=dt.date.today())
            db.add(emp)
            await db.flush()
            admin_role = await db.scalar(select(Role).where(Role.code == "admin"))
            db.add(EmployeeRole(employee_id=emp.id, role_id=admin_role.id, branch_id=None))
            created["admin"] = phone
    await db.commit()
    return created


async def _main():
    phone = settings.ADMIN_PHONE or input("Admin telefoni (+998...): ").strip()
    password = settings.ADMIN_PASSWORD or getpass.getpass("Admin paroli (kamida 8 belgi): ")
    if len(password) < 8:
        raise SystemExit("Parol kamida 8 belgidan iborat bo'lsin")
    async with SessionLocal() as db:
        print("Yaratildi:", await seed_all(db, phone, password) or "yangi narsa yo'q (hammasi mavjud)")


if __name__ == "__main__":
    asyncio.run(_main())
