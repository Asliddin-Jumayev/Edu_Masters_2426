import hashlib
import re
from fastapi import Request
from sqlalchemy import func, select
from app.models.system import LoginDevice
from app.utils.config import settings
from app.utils.time import utcnow

DEVICE_ID_RE = re.compile(r"^[A-Za-z0-9_-]{16,64}$")
_BROWSERS = [("Edg/", "Edge"), ("EdgA/", "Edge"), ("OPR/", "Opera"), ("FxiOS/", "Firefox"), ("Firefox/", "Firefox"),
             ("CriOS/", "Chrome"), ("Chrome/", "Chrome"), ("Safari/", "Safari")]  # tartib muhim: Chrome UA ichida 'Safari/' ham bor


def parse_ua(ua: str | None) -> dict:
    ua = ua or ""
    browser = next((name for key, name in _BROWSERS if key in ua), None)
    if "iPhone" in ua or "iPad" in ua or "iPod" in ua:
        os_ = "iOS"
    elif "Android" in ua:
        os_ = "Android"
    elif "Windows" in ua:
        os_ = "Windows"
    elif "Mac OS X" in ua or "Macintosh" in ua:
        os_ = "macOS"
    elif "CrOS" in ua:
        os_ = "ChromeOS"
    elif "Linux" in ua:
        os_ = "Linux"
    else:
        os_ = None
    kind = "tablet" if "iPad" in ua else "mobile" if ("iPhone" in ua or ("Android" in ua and "Mobile" in ua)) else "desktop"
    label = " · ".join(x for x in (browser, os_) if x) or "Noma'lum qurilma"
    return {"browser": browser, "os": os_, "kind": kind, "label": label}


def client_ip(request: Request) -> str:
    if settings.TRUST_PROXY:
        xff = request.headers.get("x-forwarded-for", "")
        if xff:
            return xff.split(",")[0].strip()[:45]
    return (request.client.host if request.client else "noma'lum")[:45]


def device_key(request: Request, parsed: dict) -> str:
    did = request.headers.get("x-device-id", "")
    raw = f"id:{did}" if DEVICE_ID_RE.match(did) else f"ua:{parsed['browser']}|{parsed['os']}|{parsed['kind']}"
    return hashlib.sha256(raw.encode()).hexdigest()


async def record_login(db, emp, request: Request) -> tuple[LoginDevice, bool]:
    """(qurilma, xabarnoma_yuborish_kerakmi). Faqat flush qiladi; commit chaqiruvchida."""
    ua = request.headers.get("user-agent", "")[:255]
    parsed = parse_ua(ua)
    key = device_key(request, parsed)
    ip = client_ip(request)
    dev = (await db.execute(select(LoginDevice).where(LoginDevice.employee_id == emp.id, LoginDevice.device_hash == key))).scalar_one_or_none()
    now = utcnow()
    if dev is not None:
        dev.last_seen_at, dev.last_ip, dev.login_count = now, ip, (dev.login_count or 0) + 1
        return dev, False
    had_any = (await db.scalar(select(func.count(LoginDevice.id)).where(LoginDevice.employee_id == emp.id)) or 0) > 0
    alert = had_any or settings.NEW_DEVICE_ALERT_ON_FIRST_LOGIN
    dev = LoginDevice(employee_id=emp.id, device_hash=key, label=parsed["label"], user_agent=ua or None, first_ip=ip, last_ip=ip,
                      first_seen_at=now, last_seen_at=now, login_count=1, alerted=alert)
    db.add(dev)
    await db.flush()
    return dev, alert
