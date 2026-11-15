import asyncio
from datetime import datetime, timedelta, timezone
from typing import Annotated
from fastapi import Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordBearer
from jose import ExpiredSignatureError, JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.models.employee_roles import EmployeeRole
from app.models.employees import Employee
from app.models.system import LoginDevice
from app.services.devices import device_key, parse_ua
from app.utils.access import is_admin, role_codes
from app.utils.config import settings
from app.utils.deps import MyDb
from app.utils.roles import ADMIN
from app.utils.time import today

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")
bearer = OAuth2PasswordBearer(tokenUrl="/auth/login")


# argon2 CPU ni band qiladi: event loop ni bloklamaslik uchun threadda ishlatamiz
async def get_password_hash(password: str) -> str:
    return await asyncio.to_thread(pwd_context.hash, password)


async def verify_password(plain: str, hashed: str) -> bool:
    try:
        return await asyncio.to_thread(pwd_context.verify, plain, hashed)
    except Exception:
        return False


def _make_token(user_id: int, token_type: str, lifetime: timedelta) -> str:
    now = datetime.now(timezone.utc)
    payload = {"sub": str(user_id), "type": token_type, "iat": now, "exp": now + lifetime}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_access_token(user_id: int) -> str:
    return _make_token(user_id, "access", timedelta(minutes=settings.ACCESS_TOKEN_MINUTES))


def create_refresh_token(user_id: int) -> str:
    return _make_token(user_id, "refresh", timedelta(days=settings.REFRESH_TOKEN_DAYS))


def decode_token(token: str, expected_type: str) -> int:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except ExpiredSignatureError:
        raise HTTPException(401, "Token muddati tugagan", headers={"WWW-Authenticate": "Bearer"})
    except JWTError:
        raise HTTPException(401, "Token yaroqsiz", headers={"WWW-Authenticate": "Bearer"})
    if payload.get("type") != expected_type:
        raise HTTPException(401, "Token turi noto'g'ri", headers={"WWW-Authenticate": "Bearer"})
    try:
        return int(payload["sub"])
    except (KeyError, ValueError):
        raise HTTPException(401, "Token yaroqsiz", headers={"WWW-Authenticate": "Bearer"})


def is_employee_active(emp: Employee) -> bool:
    return bool(emp.is_active) and (emp.fired_at is None or emp.fired_at > today())


async def verify_device_session(db: MyDb, request: Request, user_id: int) -> None:
    """Agar qurilma 'Kirgan qurilmalarim' ro'yxatidan olib tashlangan bo'lsa, sessiyani darhol uzadi."""
    if not request.headers.get("x-device-id"):
        return
    has_any = await db.scalar(select(LoginDevice.id).where(LoginDevice.employee_id == user_id).limit(1))
    if not has_any:
        return
    key = device_key(request, parse_ua(request.headers.get("user-agent")))
    active_dev = await db.scalar(
        select(LoginDevice.id).where(LoginDevice.employee_id == user_id, LoginDevice.device_hash == key)
    )
    if active_dev is None:
        raise HTTPException(
            401,
            "Ushbu qurilma sessiyasi tugatilgan. Qaytadan tizimga kiring.",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user(request: Request, db: MyDb, token: Annotated[str, Depends(bearer)]) -> Employee:
    user_id = decode_token(token, "access")
    result = await db.execute(
        select(Employee).where(Employee.id == user_id)
        .options(selectinload(Employee.employee_roles).selectinload(EmployeeRole.role))
        .execution_options(populate_existing=True)
    )
    user = result.scalar_one_or_none()
    if user is None or not is_employee_active(user):
        raise HTTPException(401, "Foydalanuvchi topilmadi yoki faol emas",
                            headers={"WWW-Authenticate": "Bearer"})
    await verify_device_session(db, request, user.id)
    return user


def require_roles(allowed_roles: list[str]):
    """admin hamma joyga kira oladi; qolgan rollar ro'yxat bo'yicha."""
    allowed = set(allowed_roles) | {ADMIN}

    def checker(current_user: Annotated[Employee, Depends(get_current_user)]) -> Employee:
        if role_codes(current_user) & allowed:
            return current_user
        raise HTTPException(403, "Ushbu amalni bajarish uchun sizda yetarli huquq yo'q")

    return checker