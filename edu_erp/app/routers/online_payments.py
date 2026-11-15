from fastapi import APIRouter, HTTPException
from sqlalchemy import select
from app.models.enums import PaymentStatus, SmsStatus
from app.models.finance import Payment, PaymentMethod
from app.models.online import ProviderTransaction
from app.models.students import Student
from app.schemes.common import Message
from app.schemes.online import OnlineCheckout, OnlineCheckoutResponse, ProviderTxResponse
from app.services.messaging import deliver_sms
from app.services.online_payments import create_checkout
from app.utils.access import ensure_branch, scoped
from app.utils.audit import add_audit
from app.utils.checked import check_ident, safe_commit
from app.utils.config import settings
from app.utils.deps import MyDb
from app.utils.pagination import Page, Pagination, paginate
from app.utils.permissions import FinanceUser
from app.utils.time import utcnow
from app.services.finance import q2

# DIQQAT: bu router /payments/{payment_id} dan OLDIN ulanishi kerak (routers/__init__.py)
router = APIRouter(prefix="/payments/online", tags=["Online payments"])


@router.post("/checkout", response_model=OnlineCheckoutResponse, status_code=201)
async def checkout(data: OnlineCheckout, db: MyDb, user: FinanceUser):
    """Click/Payme to'lov havolasini yaratadi (`pending` to'lov). Havola ota-onaga SMS bilan yuborilishi mumkin.
    To'lov bajarilganda webhook avtomatik balansni yangilaydi."""
    student = await check_ident(db, Student, data.student_id, "O'quvchi topilmadi")
    ensure_branch(user, student.branch_id)
    phone = student.parent_phone or student.phone
    if data.send_sms and not phone:
        raise HTTPException(400, "O'quvchida SMS yuboriladigan telefon yo'q")
    pay, url = await create_checkout(db, user, student=student, provider=data.provider, amount=data.amount,
                                     invoice_id=data.invoice_id, return_url=data.return_url)
    sms_sent = False
    if data.send_sms:
        row = await deliver_sms(db, phone=phone, student_id=student.id,
                                body=f"{settings.CENTER_NAME}: {student.first_name} uchun {q2(pay.amount):,.0f} so'm to'lov havolasi: {url}".replace(",", " "))
        sms_sent = row.status != SmsStatus.FAILED
    await safe_commit(db)
    return OnlineCheckoutResponse(payment_id=pay.id, provider=data.provider, url=url, amount=pay.amount, sms_sent=sms_sent)


@router.get("/transactions", response_model=Page[ProviderTxResponse])
async def transactions(db: MyDb, user: FinanceUser, params: Pagination, provider: str | None = None, payment_id: int | None = None):
    """Click/Payme tranzaksiyalari (nosozliklarni topish uchun)."""
    stmt = (select(ProviderTransaction).join(Payment, Payment.id == ProviderTransaction.payment_id)
            .join(Student, Student.id == Payment.student_id))
    stmt = scoped(stmt, Student.branch_id, user).order_by(ProviderTransaction.id.desc())
    if provider:
        stmt = stmt.where(ProviderTransaction.provider == provider)
    if payment_id is not None:
        stmt = stmt.where(ProviderTransaction.payment_id == payment_id)
    return await paginate(db, stmt, params)


@router.post("/{payment_id}/cancel", response_model=Message)
async def cancel_pending(payment_id: int, db: MyDb, user: FinanceUser):
    """Hali to'lanmagan onlayn to'lov havolasini bekor qiladi."""
    pay = await db.get(Payment, payment_id, with_for_update=True, populate_existing=True)
    if pay is None:
        raise HTTPException(404, "To'lov topilmadi")
    student = await db.get(Student, pay.student_id)
    ensure_branch(user, student.branch_id)
    method = await db.get(PaymentMethod, pay.method_id)
    if not method.is_online or pay.status != PaymentStatus.PENDING:
        raise HTTPException(409, "Faqat kutilayotgan onlayn to'lovni bekor qilish mumkin")
    pay.status = PaymentStatus.FAILED
    for tx in (await db.execute(select(ProviderTransaction).where(ProviderTransaction.payment_id == pay.id, ProviderTransaction.state == 1))).scalars().all():
        tx.state, tx.cancel_time = -1, utcnow()
    add_audit(db, user, "cancel", "online_payment", pay.id)
    await safe_commit(db)
    return Message(msg="To'lov havolasi bekor qilindi")
