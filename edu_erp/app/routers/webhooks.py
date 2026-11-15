"""Tashqi tizimlar (Click, Payme, Eskiz) chaqiradigan ochiq endpointlar. Autentifikatsiya — imzo/kalit orqali."""
import hmac
import logging
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from sqlalchemy import select
from app.models.communication import SmsLog
from app.models.enums import SmsStatus
from app.services.online_payments import handle_click, handle_payme
from app.services.sms_providers import map_delivery_status
from app.utils.config import settings
from app.utils.deps import MyDb

log = logging.getLogger("webhooks")
router = APIRouter(prefix="/webhooks", tags=["Webhooks"])


async def _payload(request: Request) -> dict:
    if "json" in request.headers.get("content-type", ""):
        data = await request.json()
        return {k: str(v) for k, v in data.items()} if isinstance(data, dict) else {}
    return {k: str(v) for k, v in (await request.form()).items()}


@router.post("/click", summary="Click Prepare va Complete (bitta URL)")
async def click_webhook(request: Request, db: MyDb):
    try:
        result = await handle_click(db, await _payload(request))
        await db.commit()
    except Exception:  # noqa: BLE001
        log.exception("Click webhook xatosi")
        await db.rollback()
        result = {"error": -7, "error_note": "Failed to update user"}
    return JSONResponse(result)


@router.post("/payme", summary="Payme Merchant API (JSON-RPC 2.0)")
async def payme_webhook(request: Request, db: MyDb):
    try:
        body = await request.json()
    except Exception:  # noqa: BLE001
        return JSONResponse({"jsonrpc": "2.0", "id": None, "error": {"code": -32700, "message": "Parse error"}})
    try:
        result = await handle_payme(db, body, request.headers.get("authorization"))
        if "error" in result:
            await db.rollback()
        else:
            await db.commit()
    except Exception:  # noqa: BLE001
        log.exception("Payme webhook xatosi")
        await db.rollback()
        result = {"jsonrpc": "2.0", "id": body.get("id") if isinstance(body, dict) else None,
                  "error": {"code": -32400, "message": {"ru": "Системная ошибка", "uz": "Tizim xatosi", "en": "System error"}}}
    return JSONResponse(result)


_RANK = {SmsStatus.QUEUED: 0, SmsStatus.SENT: 1, SmsStatus.DELIVERED: 2, SmsStatus.FAILED: 2}


@router.post("/sms/eskiz", summary="Eskiz yetkazish holati (callback)")
async def eskiz_callback(request: Request, db: MyDb, token: str = ""):
    if not settings.SMS_CALLBACK_TOKEN or not hmac.compare_digest(token, settings.SMS_CALLBACK_TOKEN):
        raise HTTPException(403, "Noto'g'ri token")
    data = await _payload(request)
    mid = data.get("request_id") or data.get("message_id") or data.get("id")
    status = map_delivery_status(data.get("status"))
    row = (await db.execute(select(SmsLog).where(SmsLog.provider_message_id == str(mid)))).scalar_one_or_none() if mid else None
    if row and status and _RANK[status] > _RANK[row.status]:
        row.status = status
        if status == SmsStatus.FAILED:
            row.error = (data.get("status") or "failed")[:255]
    await db.commit()
    return {"ok": True, "updated": bool(row and status)}
