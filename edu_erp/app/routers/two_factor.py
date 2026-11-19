"""2FA (Ikki bosqichli autentifikatsiya / Google Authenticator) routeri."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.models.system import Employee2FA
from app.services.two_factor import (
    generate_totp_secret,
    get_totp_uri,
    verify_totp,
)
from app.utils.checked import safe_commit
from app.utils.config import settings
from app.utils.deps import MyDb
from app.utils.permissions import AuthUser
from app.utils.security import verify_password

router = APIRouter(prefix="/auth/2fa", tags=["Two-Factor Auth (2FA)"])


class Setup2FAResponse(BaseModel):
    secret: str
    otpauth_url: str
    instructions: str


class Enable2FARequest(BaseModel):
    secret: str = Field(..., min_length=16, description="Setup paytida olingan secret kalit")
    code: str = Field(..., min_length=6, max_length=6, description="Google Authenticatordan 6 xonali kod")


class Disable2FARequest(BaseModel):
    password: str = Field(..., description="Tasdiqlash uchun xodim paroli")


class Verify2FACodeRequest(BaseModel):
    code: str = Field(..., min_length=6, max_length=6)


@router.get("/status")
async def two_factor_status(db: MyDb, user: AuthUser):
    """Joriy xodimda 2FA yoqilganmi-yo'qligini tekshiradi."""
    row = (await db.execute(
        select(Employee2FA).where(Employee2FA.employee_id == user.id)
    )).scalar_one_or_none()
    return {"enabled": bool(row and row.is_enabled)}


@router.post("/setup", response_model=Setup2FAResponse)
async def setup_two_factor(user: AuthUser):
    """
    2FA ni ulash uchun yangi maxfiy kalit va otpauth havola yaratadi.
    Foydalanuvchi buni Google Authenticator ilovasida skanerlaydi.
    """
    secret = generate_totp_secret()
    account_label = f"{user.first_name} ({user.phone})"
    uri = get_totp_uri(secret, account_label, settings.CENTER_NAME)

    return Setup2FAResponse(
        secret=secret,
        otpauth_url=uri,
        instructions="Google Authenticator ilovasini oching, '+' ni bosing va ushbu havola yoki kalitni kiriting. Keyin chiqqan 6 xonali kodni /enable endpointiga yuboring.",
    )


@router.post("/enable")
async def enable_two_factor(data: Enable2FARequest, db: MyDb, user: AuthUser):
    """
    Kiritilgan kodni tekshirib, 2FA ni foydalanuvchi uchun faollashtiradi.
    """
    if not verify_totp(data.secret, data.code):
        raise HTTPException(400, "Tasdiqlash kodi noto'g'ri yoki muddati tugagan")

    row = (await db.execute(
        select(Employee2FA).where(Employee2FA.employee_id == user.id)
    )).scalar_one_or_none()

    if row is None:
        row = Employee2FA(employee_id=user.id, secret=data.secret, is_enabled=True)
        db.add(row)
    else:
        row.secret = data.secret
        row.is_enabled = True

    await safe_commit(db)
    return {"ok": True, "msg": "Ikki bosqichli autentifikatsiya (2FA) muvaffaqiyatli yoqildi"}


@router.post("/disable")
async def disable_two_factor(data: Disable2FARequest, db: MyDb, user: AuthUser):
    """2FA ni o'chirish (parol bilan tasdiqlanadi)."""
    if not await verify_password(data.password, user.password_hash):
        raise HTTPException(400, "Parol noto'g'ri")

    row = (await db.execute(
        select(Employee2FA).where(Employee2FA.employee_id == user.id)
    )).scalar_one_or_none()

    if row and row.is_enabled:
        row.is_enabled = False
        await safe_commit(db)

    return {"ok": True, "msg": "2FA o'chirildi"}


@router.post("/verify-code")
async def verify_code_endpoint(data: Verify2FACodeRequest, db: MyDb, user: AuthUser):
    """Kirish paytida 2FA kodini tekshirish."""
    row = (await db.execute(
        select(Employee2FA).where(Employee2FA.employee_id == user.id, Employee2FA.is_enabled.is_(True))
    )).scalar_one_or_none()

    if not row:
        return {"valid": True, "msg": "2FA yoqilmagan"}

    is_valid = verify_totp(row.secret, data.code)
    if not is_valid:
        raise HTTPException(400, "2FA kodi noto'g'ri")
    return {"valid": True, "msg": "Kod tasdiqlandi"}
