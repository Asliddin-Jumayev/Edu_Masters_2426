import logging
from datetime import timedelta
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from app.models.employees import Employee
from app.schemes.auth import ChangePassword, MeResponse, MyRole, RefreshToken, TokenPair
from app.models.system import LoginDevice
from app.schemes.common import Message, normalize_phone
from app.schemes.online import DeviceResponse, EmailUpdate
from app.services import email as mail
from app.services.devices import client_ip, device_key, parse_ua, record_login
from app.services.messaging import notify
from app.utils.audit import add_audit
from app.utils.time import utcnow
from app.utils.access import branch_scope
from app.utils.checked import safe_commit
from app.utils.config import settings
from app.utils.deps import MyDb
from app.utils.permissions import AuthUser
from app.utils.rate_limit import limiter
from app.utils.security import (create_access_token, create_refresh_token, decode_token, get_password_hash,
                                is_employee_active, verify_device_session, verify_password)

log = logging.getLogger("auth")
router = APIRouter(prefix="/auth", tags=["Auth"])


def _tokens(user_id: int) -> TokenPair:
    return TokenPair(access_token=create_access_token(user_id), refresh_token=create_refresh_token(user_id))


async def _track_device(db, emp: Employee, request: Request, background: BackgroundTasks) -> None:
    """Qurilmani qayd etadi va yangi qurilma bo'lsa darhol Gmail'ga xabar yuboradi."""
    eid = emp.id
    name = emp.first_name
    user_email = (emp.email or "").strip()

    try:
        # 1. record_login chaqirilishidan OLDIN bu qurilma bazada bormi-yo'qligini tekshiramiz
        ua_label = parse_ua(request.headers.get("user-agent"))
        key = device_key(request, ua_label)
        old_dev_id = await db.scalar(
            select(LoginDevice.id).where(
                LoginDevice.employee_id == eid,
                LoginDevice.device_hash == key,
            )
        )
        is_new_device = old_dev_id is None

        # 2. Qurilmani bazaga yozamiz
        dev, alert = await record_login(db, emp, request)
        label = dev.label or ua_label
        ip = dev.last_ip or client_ip(request) or "127.0.0.1"

        if is_new_device or alert:
            notify(db, eid, "security", "Yangi qurilmadan kirildi", f"{label} · IP {ip}")
            add_audit(db, emp, "login_new_device", "employee", eid, new={"device": label, "ip": ip})
        await db.commit()
    except Exception:  # noqa: BLE001
        await db.rollback()
        log.exception("Qurilmani qayd etib bo'lmadi (login davom etadi)")
        return

    # 3. Agar qurilma yangi bo'lsa va foydalanuvchida email bo'lsa -> Xuddi test-email kabi darhol yuboramiz!
    if (is_new_device or alert) and user_email:
        when = (utcnow() + timedelta(hours=settings.TIMEZONE_OFFSET_HOURS)).strftime("%d.%m.%Y %H:%M") + f" (UTC+{settings.TIMEZONE_OFFSET_HOURS})"
        subject, text, html = mail.new_device_message(
            name=name,
            label=label,
            ip=ip,
            when=when,
            profile_url=f"{settings.FRONTEND_URL.rstrip('/')}/profile",
        )
        try:
            await mail.send_email(user_email, subject, text, html)
            print(f"\n>>> [GMAIL SENT] Yangi qurilma xati {user_email} manziliga yuborildi! ({label})\n")
        except Exception as e:  # noqa: BLE001
            print(f"\n>>> [GMAIL ERROR] Xat yuborishda xato: {e}\n")
            log.exception("Yangi qurilma xatini yuborishda xatolik")
    else:
        print(f"\n>>> [DEVICE INFO] Xat yuborilmadi: is_new_device={is_new_device}, alert={alert}, email='{user_email}'\n")


@router.post("/login", response_model=TokenPair)
@limiter.limit(settings.LOGIN_RATE_LIMIT)
async def login(request: Request, background: BackgroundTasks, db: MyDb, form: OAuth2PasswordRequestForm = Depends()):
    try:
        phone = normalize_phone(form.username)
    except ValueError:
        phone = form.username
    emp = (await db.execute(select(Employee).where(Employee.phone == phone))).scalar_one_or_none()
    if emp is None or not await verify_password(form.password, emp.password_hash):
        raise HTTPException(401, "Telefon yoki parol noto'g'ri", headers={"WWW-Authenticate": "Bearer"})
    if not is_employee_active(emp):
        raise HTTPException(403, "Hisob faol emas")
    emp_id = emp.id
    await _track_device(db, emp, request, background)
    return _tokens(emp_id)


@router.post("/refresh", response_model=TokenPair)
async def refresh(request: Request, data: RefreshToken, db: MyDb):
    user_id = decode_token(data.refresh_token, "refresh")
    emp = await db.get(Employee, user_id)
    if emp is None or not is_employee_active(emp):
        raise HTTPException(401, "Foydalanuvchi faol emas")
    await verify_device_session(db, request, emp.id)
    return _tokens(emp.id)


@router.get("/me", response_model=MeResponse)
async def me(user: AuthUser):
    scope = branch_scope(user)
    return MeResponse(
        id=user.id, first_name=user.first_name, last_name=user.last_name, phone=user.phone, email=user.email,
        branch_id=user.branch_id, position=user.position,
        roles=[MyRole(role_id=er.role_id, code=er.role.code, branch_id=er.branch_id)
               for er in user.employee_roles if er.role],
        branch_ids=None if scope is None else sorted(scope))


@router.post("/change-password", response_model=Message)
async def change_password(data: ChangePassword, db: MyDb, user: AuthUser):
    if not await verify_password(data.old_password, user.password_hash):
        raise HTTPException(400, "Eski parol noto'g'ri")
    user.password_hash = await get_password_hash(data.new_password)
    await safe_commit(db)
    return Message(msg="Parol o'zgartirildi")


# ---------------- qurilmalar va email ----------------
@router.get("/devices", response_model=list[DeviceResponse])
async def my_devices(request: Request, db: MyDb, user: AuthUser):
    """Hisobga kirilgan qurilmalar. `is_current` — shu so'rov yuborilgan qurilma (X-Device-Id bo'yicha)."""
    key = device_key(request, parse_ua(request.headers.get("user-agent")))
    rows = (await db.execute(select(LoginDevice).where(LoginDevice.employee_id == user.id).order_by(LoginDevice.last_seen_at.desc()))).scalars().all()
    return [DeviceResponse(id=d.id, label=d.label, first_ip=d.first_ip, last_ip=d.last_ip, first_seen_at=d.first_seen_at,
                           last_seen_at=d.last_seen_at, login_count=d.login_count, is_current=d.device_hash == key) for d in rows]


@router.delete("/devices/{device_id}", response_model=Message)
async def forget_device(device_id: int, db: MyDb, user: AuthUser):
    """Qurilmani unutadi: shu qurilmadan keyingi kirishda yana xabarnoma yuboriladi."""
    d = await db.get(LoginDevice, device_id)
    if d is None or d.employee_id != user.id:
        raise HTTPException(404, "Qurilma topilmadi")
    await db.delete(d)
    await safe_commit(db)
    return Message(msg="Qurilma ro'yxatdan olib tashlandi")


@router.put("/me/email", response_model=Message)
async def set_my_email(data: EmailUpdate, db: MyDb, user: AuthUser):
    """Xavfsizlik xabarnomalari uchun email. Parol bilan tasdiqlanadi."""
    if not await verify_password(data.password, user.password_hash):
        raise HTTPException(400, "Parol noto'g'ri")
    old = user.email
    user.email = data.email.strip()
    add_audit(db, user, "update", "employee_email", user.id, old={"email": old}, new={"email": user.email})
    await safe_commit(db)
    return Message(msg="Email saqlandi")


@router.post("/me/test-email", response_model=Message)
async def send_my_test_email(user: AuthUser):
    if not user.email:
        raise HTTPException(400, "Avval email manzilingizni kiriting")
    subject, text, html = mail.make_test_message(user.first_name)
    try:
        await mail.send_email(user.email, subject, text, html)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"Email yuborib bo'lmadi: {e.__class__.__name__}")
    return Message(msg=f"Test xati {user.email} manziliga yuborildi")