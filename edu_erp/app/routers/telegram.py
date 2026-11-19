"""Telegram Webhook Router."""
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.services.telegram_bot import process_telegram_update
from app.utils.config import settings
from app.utils.permissions import AdminUser

router = APIRouter(prefix="/telegram", tags=["Telegram Bot"])


@router.post("/webhook")
async def telegram_webhook(request: Request):
    """Telegram Bot API dan keluvchi yangilanishlarni qabul qilish."""
    try:
        body = await request.json()
    except Exception:
        return JSONResponse({"ok": False, "error": "Invalid JSON"}, status_code=400)

    result = await process_telegram_update(body)
    return JSONResponse(result)


@router.get("/status")
async def telegram_status(user: AdminUser):
    """Telegram bot holati."""
    bot_token = getattr(settings, "TELEGRAM_BOT_TOKEN", None) or ""
    return {
        "configured": bool(bot_token),
        "bot_username": getattr(settings, "TELEGRAM_BOT_USERNAME", None) or "EduMastersBot",
    }
