from fastapi import APIRouter, HTTPException, Request
from app.schemes.online import IntegrationsStatus, ProviderStatus, TestEmail, TestResult, TestSms
from app.services import email as mail
from app.services.messaging import deliver_sms
from app.services.online_payments import click_configured, payme_configured
from app.services.sms_providers import get_provider
from app.models.enums import SmsStatus
from app.utils.checked import safe_commit
from app.utils.config import settings
from app.utils.deps import MyDb
from app.utils.permissions import AdminUser

router = APIRouter(prefix="/system", tags=["System"])


def _base(request: Request) -> str:
    return (settings.PUBLIC_API_URL or str(request.base_url)).rstrip("/")


@router.get("/integrations", response_model=IntegrationsStatus)
async def integrations(request: Request, user: AdminUser):
    """Integratsiyalar holati va Click/Payme kabinetiga kiritiladigan manzillar. Maxfiy kalitlar HECH QACHON qaytarilmaydi."""
    base = _base(request)
    sms = settings.SMS_PROVIDER.lower()
    eskiz_ok = bool(settings.ESKIZ_EMAIL and settings.ESKIZ_PASSWORD)
    cb = f"{base}/webhooks/sms/eskiz?token=<SMS_CALLBACK_TOKEN>" if settings.SMS_CALLBACK_TOKEN else ""
    return IntegrationsStatus(
        click=ProviderStatus(configured=click_configured(), urls={"prepare_url": f"{base}/webhooks/click", "complete_url": f"{base}/webhooks/click"},
                             info={"service_id": settings.CLICK_SERVICE_ID or None}),
        payme=ProviderStatus(configured=payme_configured(), urls={"endpoint_url": f"{base}/webhooks/payme"},
                             info={"merchant_id": settings.PAYME_MERCHANT_ID or None, "checkout": settings.PAYME_CHECKOUT_URL}),
        sms=ProviderStatus(configured=(sms == "console") or eskiz_ok, urls={"callback_url": cb} if cb else {},
                           info={"provider": sms, "sender": settings.ESKIZ_FROM if sms == "eskiz" else None}),
        email=ProviderStatus(configured=mail.is_configured(), info={"backend": mail.backend_name(), "from": settings.SMTP_FROM or settings.SMTP_USER or None,
                                                                   "host": settings.SMTP_HOST or None}),
        public_api_url=base, frontend_url=settings.FRONTEND_URL)


@router.post("/integrations/test-sms", response_model=TestResult)
async def test_sms(data: TestSms, db: MyDb, user: AdminUser):
    """Sozlamalarni tekshirish uchun SMS. Eskiz test hisobida faqat ruxsat etilgan matn o'tadi."""
    row = await deliver_sms(db, phone=data.phone, body=data.text or f"{settings.CENTER_NAME}: test SMS")
    await safe_commit(db)
    ok = row.status != SmsStatus.FAILED
    return TestResult(ok=ok, detail=None if ok else row.error)


@router.post("/integrations/test-email", response_model=TestResult)
async def test_email(data: TestEmail, user: AdminUser):
    to = data.to or user.email
    if not to:
        raise HTTPException(400, "Email manzili kiritilmagan (profilingizga email qo'shing yoki 'to' yuboring)")
    subject, text, html = mail.make_test_message(user.first_name)
    try:
        await mail.send_email(to, subject, text, html)
    except Exception as e:  # noqa: BLE001
        return TestResult(ok=False, detail=f"{e.__class__.__name__}: {e}"[:300])
    return TestResult(ok=True, detail=f"{mail.backend_name()} orqali {to} manziliga yuborildi")
