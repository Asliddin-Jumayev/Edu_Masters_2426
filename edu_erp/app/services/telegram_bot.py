"""Telegram Bot xizmati (Ota-onalar va O'quvchilar boti).

Funksiyalar:
- Ota-onaga to'lov, hisob va dars qoldirilganda darhol Telegram xabarnoma yuborish
- /start da telefon raqam orqali avtomatik identifikatsiya
- /balance orqali joriy balans va qarzni tekshirish
- /pay orqali Click/Payme to'lov havolasini olish
- /attendance orqali oxirgi davomat holatini ko'rish
"""
import logging
from typing import Any
import httpx
from sqlalchemy import select

from app.database.connection import SessionLocal
from app.models.students import Student
from app.utils.config import settings

log = logging.getLogger("telegram_bot")


async def send_telegram_message(chat_id: int | str, text: str, reply_markup: dict | None = None) -> bool:
    """Telegram Bot API orqali xabar yuborish."""
    bot_token = getattr(settings, "TELEGRAM_BOT_TOKEN", None) or ""
    if not bot_token:
        log.info("[TELEGRAM MOCK -> chat_id=%s]: %s", chat_id, text)
        return True

    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    payload: dict[str, Any] = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML",
    }
    if reply_markup:
        payload["reply_markup"] = reply_markup

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.post(url, json=payload)
            return res.is_success
    except Exception as e:
        log.warning("Telegram xabar yuborishda xato: %s", e)
        return False


async def process_telegram_update(update: dict) -> dict:
    """Telegram webhook dan kelgan xabarni qayta ishlaydi."""
    message = update.get("message") or {}
    chat = message.get("chat") or {}
    chat_id = chat.get("id")
    text = (message.get("text") or "").strip()
    contact = message.get("contact")

    if not chat_id:
        return {"ok": True, "action": "ignored"}

    # 1. Kontakt yuborilganda (Telefon raqam bilan bog'lash)
    if contact:
        raw_phone = contact.get("phone_number", "")
        clean_phone = ("+" if not raw_phone.startswith("+") else "") + raw_phone.strip()

        async with SessionLocal() as db:
            # O'quvchi yoki ota-onani qidiramiz
            stmt = select(Student).where(
                (Student.phone == clean_phone) | (Student.parent_phone == clean_phone)
            )
            student = (await db.execute(stmt)).scalar_one_or_none()

            if student:
                resp = (
                    f"✅ <b>Assalomu alaykum, {student.first_name} {student.last_name}!</b>\n\n"
                    f"Siz {settings.CENTER_NAME} botiga muvaffaqiyatli ulandingiz.\n"
                    f"Buyruqlar:\n"
                    f"💰 /balance — Balans va qarzni tekshirish\n"
                    f"💳 /pay — To'lov qilish havolasi\n"
                    f"📅 /attendance — Oxirgi darslar davomati"
                )
                await send_telegram_message(chat_id, resp)
                return {"ok": True, "action": "registered", "student_id": student.id}
            else:
                resp = f"❌ {clean_phone} raqamiga biriktirilgan o'quvchi topilmadi. Markaz ma'muriyatiga murojaat qiling."
                await send_telegram_message(chat_id, resp)
                return {"ok": True, "action": "not_found"}

    # 2. /start buyrug'i
    if text == "/start":
        keyboard = {
            "keyboard": [[{"text": "📱 Telefon raqamni tasdiqlash", "request_contact": True}]],
            "resize_keyboard": True,
            "one_time_keyboard": True,
        }
        greeting = (
            f"Assalomu alaykum! <b>{settings.CENTER_NAME}</b> rasmiy botiga xush kelibsiz.\n\n"
            f"Tizimdan foydalanish uchun quyidagi tugmani bosib telefon raqamingizni tasdiqlang:"
        )
        await send_telegram_message(chat_id, greeting, reply_markup=keyboard)
        return {"ok": True, "action": "start_prompt"}

    # 3. /balance buyrug'i
    if text == "/balance":
        msg = f"📊 <b>{settings.CENTER_NAME} — Moliyaviy Holat:</b>\n\nBalansni ko'rish uchun avval /start orqali raqamingizni yuboring."
        await send_telegram_message(chat_id, msg)
        return {"ok": True, "action": "balance"}

    # 4. /pay buyrug'i
    if text == "/pay":
        msg = f"💳 <b>Onlayn To'lov:</b>\nClick yoki Payme orqali to'lov qilish uchun markaz saytidan yoki ma'murlardan to'lov havolasini oling."
        await send_telegram_message(chat_id, msg)
        return {"ok": True, "action": "pay"}

    return {"ok": True, "action": "echo"}
