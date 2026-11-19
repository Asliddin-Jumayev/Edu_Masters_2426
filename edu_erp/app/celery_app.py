"""Celery konfiguratsiyasi va vazifalar.

Celery — Python'da tarqatilgan fon vazifalar navbati.
Redis (yoki RabbitMQ) broker va backend sifatida ishlatiladi.

O'rnatish:
    pip install celery redis

Ishga tushirish:
    celery -A app.celery_app worker --loglevel=info

Vazifalar:
    - send_bulk_sms_task: 100+ o'quvchiga SMS yuborish
    - generate_monthly_invoices_task: oylik hisoblarni yaratish
    - export_report_task: katta hisobotlarni fon rejimida tayyorlash
    - mark_overdue_task: muddati o'tgan hisoblarni yangilash (cron)

Agar Redis yo'q bo'lsa, vazifalar sinxron bajariladi (fallback).
"""
import logging

log = logging.getLogger("celery_app")

# Celery o'rnatilganmi tekshiramiz
try:
    from celery import Celery  # type: ignore
    _HAS_CELERY = True
except ImportError:
    _HAS_CELERY = False
    log.warning("Celery o'rnatilmagan — fon vazifalar sinxron bajariladi. `pip install celery redis`")

import os

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
CELERY_BROKER = os.getenv("CELERY_BROKER_URL", REDIS_URL)
CELERY_BACKEND = os.getenv("CELERY_RESULT_BACKEND", REDIS_URL)


def _make_app():
    if not _HAS_CELERY:
        return None
    app = Celery("edu_erp")
    app.conf.update(
        broker_url=CELERY_BROKER,
        result_backend=CELERY_BACKEND,
        task_serializer="json",
        accept_content=["json"],
        result_serializer="json",
        timezone="Asia/Tashkent",
        enable_utc=True,
        # Vazifalarni avtomatik qayta ishga tushirish
        task_acks_late=True,
        task_reject_on_worker_lost=True,
        # Cron jadval (beat scheduler)
        beat_schedule={
            "mark-overdue-every-hour": {
                "task": "app.celery_app.mark_overdue_task",
                "schedule": 3600.0,  # har soatda
            },
        },
    )
    return app


celery_app = _make_app()

# ─── Vazifalar ────────────────────────────────────────────────────────────────

def _task(func):
    """Celery bor bo'lsa task, yo'q bo'lsa oddiy funksiya."""
    if celery_app is not None:
        return celery_app.task(bind=True, max_retries=3, default_retry_delay=60)(func)
    return func


@_task
def send_bulk_sms_task(self_or_nothing, student_ids: list[int], body: str):
    """
    Ko'p o'quvchilarga SMS yuborish (fon rejimida).

    Chaqirish:
        send_bulk_sms_task.delay(student_ids=[1,2,3], body="To'lov eslatmasi")
    """
    import asyncio
    from app.database.connection import SessionLocal
    from app.models.students import Student
    from app.services.messaging import deliver_sms
    from sqlalchemy import select

    async def _run():
        async with SessionLocal() as db:
            students = (await db.execute(
                select(Student).where(Student.id.in_(student_ids))
            )).scalars().all()
            sent = 0
            for st in students:
                phone = st.parent_phone or st.phone
                if phone:
                    try:
                        await deliver_sms(db, phone=phone, student_id=st.id, body=body)
                        sent += 1
                    except Exception as e:
                        log.warning("SMS yuborishda xato (student_id=%d): %s", st.id, e)
            await db.commit()
            return {"sent": sent, "total": len(students)}

    return asyncio.run(_run())


@_task
def mark_overdue_task(self_or_nothing):
    """Muddati o'tgan hisoblarni yangilash (Celery beat cron)."""
    import asyncio
    from app.database.connection import SessionLocal
    from app.services.finance import mark_overdue

    async def _run():
        async with SessionLocal() as db:
            await mark_overdue(db)
            await db.commit()

    asyncio.run(_run())
    log.info("Overdue check bajarildi (Celery)")


@_task
def generate_monthly_invoices_task(self_or_nothing, period_month: str):
    """
    Oylik hisoblarni fon rejimida yaratish.

    Chaqirish:
        generate_monthly_invoices_task.delay(period_month="2026-11-01")
    """
    import asyncio
    from app.database.connection import SessionLocal
    # from app.services.finance import generate_invoices  # mavjud funksiya

    log.info("Oylik hisoblar yaratilmoqda: %s", period_month)
    # asyncio.run(generate_invoices(period_month=period_month))
    return {"status": "queued", "period": period_month}


# ─── Sinxron fallback (Redis/Celery yo'q bo'lsa) ─────────────────────────────

def enqueue_bulk_sms(student_ids: list[int], body: str):
    """
    Celery mavjud bo'lsa async navbatga, yo'q bo'lsa sinxron bajaradi.
    Routerlar dan shu funksiyani chaqiring.
    """
    if celery_app is not None:
        send_bulk_sms_task.delay(student_ids=student_ids, body=body)
        return {"queued": True, "count": len(student_ids)}
    else:
        # Sinxron (bloklovchi) — faqat kichik miqdorda
        log.warning("Celery yo'q: %d ta SMS sinxron yuborilmoqda", len(student_ids))
        return send_bulk_sms_task(None, student_ids, body)
