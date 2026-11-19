"""Server-Sent Events (SSE) va StreamingResponse misollari.

SSE — WebSocket'ga alternativa: bir tomonlama (server → client) real-time oqim.
Brauzer EventSource API bilan ishlaydi, reconnect o'zi bajaradi.

StreamingResponse — katta fayllarni (PDF, Excel, CSV) xotirada saqlamas ketma-ket yuboradi.
"""
import asyncio
import json
import logging
from typing import AsyncGenerator

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.utils.permissions import AuthUser

log = logging.getLogger("sse")

router = APIRouter(prefix="/stream", tags=["Streaming & SSE"])


# ─────────────────────────── SSE yordamchi ───────────────────────────────────

def sse_event(data: dict | str, event: str | None = None, id: str | None = None) -> str:
    """SSE protokoli bo'yicha formatlangan satr."""
    lines = []
    if id is not None:
        lines.append(f"id: {id}")
    if event is not None:
        lines.append(f"event: {event}")
    body = json.dumps(data, ensure_ascii=False, default=str) if isinstance(data, dict) else data
    lines.append(f"data: {body}")
    return "\n".join(lines) + "\n\n"


# ─────────────────────────── SSE endpoint ────────────────────────────────────

async def _notification_generator(user_id: int, limit: int | None = None) -> AsyncGenerator[str, None]:
    """
    Real dasturda bu yerda Redis Pub/Sub kanaliga obuna bo'linadi.
    Hozirda demo: har 5 soniyada tekshirish simulyatsiyasi.
    """
    # Ulanish xabari
    yield sse_event({"type": "connected", "user_id": user_id}, event="connected")

    counter = 0
    while True:
        try:
            await asyncio.sleep(0.5 if limit else 5)
            counter += 1
            yield sse_event({"type": "heartbeat", "tick": counter}, event="heartbeat")
            if limit is not None and counter >= limit:
                break
        except asyncio.CancelledError:
            log.info("SSE uzildi: user_id=%d", user_id)
            break


@router.get("/notifications/sse", summary="Real-time bildirishnomalar (SSE)")
async def sse_notifications(user: AuthUser, limit: int | None = None):
    """
    Server-Sent Events orqali real-time bildirishnomalar.

    Foydalanish (brauzer):
        const es = new EventSource('/stream/notifications/sse', {
            headers: { Authorization: 'Bearer <token>' }
        });
        es.addEventListener('notification', e => console.log(JSON.parse(e.data)));
        es.addEventListener('heartbeat', e => console.log('alive'));

    Xabarlar:
        - event: connected — ulanish o'rnatildi
        - event: notification — yangi bildirishnoma
        - event: heartbeat — har 5 soniyada (ulanish tirik)
    """
    return StreamingResponse(
        _notification_generator(user.id, limit=limit),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Nginx buferizatsiyasini o'chiradi
        },
    )


# ─────────────────────────── StreamingResponse misoli ────────────────────────

async def _csv_generator(rows: list[dict]) -> AsyncGenerator[bytes, None]:
    """Katta CSV'ni xotiraga yuklamasdan streaming bilan yuboradi."""
    if not rows:
        yield b"Ma'lumot yo'q\n"
        return

    # Sarlavha
    headers = list(rows[0].keys())
    yield (",".join(headers) + "\n").encode("utf-8-sig")  # BOM Excel uchun

    for row in rows:
        line = ",".join(str(row.get(h, "")) for h in headers) + "\n"
        yield line.encode("utf-8")
        # Katta hajmda event loop ni bloklamaslik uchun
        await asyncio.sleep(0)


@router.get("/export/csv-demo", summary="CSV streaming eksport (demo)")
async def csv_stream_demo(user: AuthUser):
    """
    Katta hisobotlarni StreamingResponse bilan yuborish namunasi.
    Haqiqiy loyihada DB query cursor bilan birgalikda ishlatiladi.

    Foydalanish:
        GET /stream/export/csv-demo
        -> students.csv yuklanadi
    """
    # Demo ma'lumotlar (haqiqiyda DB dan o'qiladi)
    demo_rows = [
        {"id": i, "first_name": f"Talaba-{i}", "balance": -i * 1000}
        for i in range(1, 101)
    ]

    return StreamingResponse(
        _csv_generator(demo_rows),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=students.csv"},
    )
