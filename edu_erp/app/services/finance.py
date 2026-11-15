"""Pul oqimi.

Haqiqat manbai: student_balance_transactions (faqat INSERT).
  charge  (-)  hisob yozilganda         payment (+)  to'lov
  refund  (-)  to'lov qaytarilganda      adjustment (±) qo'lda tuzatish
students.balance = ledger yig'indisi (kesh). Manfiy = qarzdorlik.

invoices.paid_amount / status har safar ledger o'zgargach recompute_invoices() bilan
QAYTA HISOBLANADI (idempotent, drift bo'lmaydi):
  1) invoice_id ko'rsatilgan to'lov avval o'sha hisobga,
  2) qolgan mablag' + musbat tuzatishlar eng eski hisobdan boshlab (FIFO).
"""
from datetime import timedelta
from decimal import Decimal, ROUND_HALF_UP
from fastapi import HTTPException
from sqlalchemy import or_, select, update
from app.models.enums import (BalanceTxnType, DiscountType, EnrollmentStatus, InvoiceStatus, PaymentStatus)
from app.models.finance import Discount, Invoice, Payment, StudentBalanceTransaction
from app.models.students import Enrollment, Student
from app.utils.time import month_end, month_start, today, utcnow

ZERO = Decimal("0")


def q2(x) -> Decimal:
    return Decimal(x).quantize(Decimal("0.01"), ROUND_HALF_UP)


async def lock_student(db, student_id: int) -> Student:
    s = await db.get(Student, student_id, with_for_update=True, populate_existing=True)
    if s is None:
        raise HTTPException(404, "O'quvchi topilmadi")
    return s


async def add_ledger(db, student_id: int, txn_type: BalanceTxnType, amount: Decimal,
                     ref_type: str | None, ref_id: int | None, user=None) -> StudentBalanceTransaction:
    student = await lock_student(db, student_id)  # parallel to'lovlarda balance_after buzilmasin
    new_balance = q2((student.balance or ZERO) + amount)
    student.balance = new_balance
    txn = StudentBalanceTransaction(
        student_id=student_id, type=txn_type, amount=q2(amount), balance_after=new_balance,
        reference_type=ref_type, reference_id=ref_id, created_by=getattr(user, "id", None))
    db.add(txn)
    await db.flush()
    return txn


async def recompute_invoices(db, student_id: int):
    invoices = (await db.execute(
        select(Invoice).where(Invoice.student_id == student_id, Invoice.status != InvoiceStatus.CANCELLED)
        .order_by(Invoice.period_month, Invoice.id))).scalars().all()
    payments = (await db.execute(
        select(Payment).where(Payment.student_id == student_id, Payment.status == PaymentStatus.COMPLETED,
                              Payment.is_refunded.is_(False)).order_by(Payment.id))).scalars().all()
    adj_sum = (await db.execute(
        select(StudentBalanceTransaction.amount).where(
            StudentBalanceTransaction.student_id == student_id,
            StudentBalanceTransaction.type == BalanceTxnType.ADJUSTMENT))).scalars().all()

    by_id = {i.id: i for i in invoices}
    paid = {i.id: ZERO for i in invoices}
    pool = ZERO
    for p in payments:
        inv = by_id.get(p.invoice_id)
        if inv is not None:
            take = min(p.amount, inv.total - paid[inv.id])
            paid[inv.id] += take
            pool += p.amount - take
        else:
            pool += p.amount
    pool = max(ZERO, pool + sum(adj_sum, ZERO))
    for inv in invoices:
        need = inv.total - paid[inv.id]
        if need > 0 and pool > 0:
            take = min(need, pool)
            paid[inv.id] += take
            pool -= take

    now = today()
    for inv in invoices:
        inv.paid_amount = q2(paid[inv.id])
        if paid[inv.id] >= inv.total:
            inv.status = InvoiceStatus.PAID
        elif paid[inv.id] > 0:
            inv.status = InvoiceStatus.PARTIAL
        else:
            inv.status = InvoiceStatus.UNPAID
        if inv.status in (InvoiceStatus.UNPAID, InvoiceStatus.PARTIAL) and inv.due_date < now:
            inv.status = InvoiceStatus.OVERDUE
    await db.flush()


async def mark_overdue(db) -> int:
    res = await db.execute(
        update(Invoice).where(Invoice.status.in_([InvoiceStatus.UNPAID, InvoiceStatus.PARTIAL]),
                              Invoice.due_date < today()).values(status=InvoiceStatus.OVERDUE))
    await db.commit()
    return res.rowcount or 0


async def compute_discount(db, student_id: int, enrollment_id: int | None, period_month, amount: Decimal) -> Decimal:
    start, end = month_start(period_month), month_end(period_month)
    cond = Discount.enrollment_id.is_(None)
    if enrollment_id is not None:
        cond = or_(cond, Discount.enrollment_id == enrollment_id)
    rows = (await db.execute(select(Discount).where(
        Discount.student_id == student_id, cond, Discount.valid_from <= end,
        or_(Discount.valid_to.is_(None), Discount.valid_to >= start)))).scalars().all()
    total = ZERO
    for d in rows:
        total += amount * d.value / 100 if d.type == DiscountType.PERCENT else d.value
    return q2(min(total, amount))


def eligible_for_month(enr: Enrollment, period_month) -> bool:
    start, end = month_start(period_month), month_end(period_month)
    if enr.status != EnrollmentStatus.ACTIVE or enr.joined_at > end:
        return False
    return enr.left_at is None or enr.left_at >= start


async def create_invoice(db, user, *, student_id: int, enrollment_id: int | None, period_month,
                         amount: Decimal, discount: Decimal, due_days: int, due_date=None) -> Invoice:
    total = q2(amount - discount)
    inv = Invoice(student_id=student_id, enrollment_id=enrollment_id, period_month=month_start(period_month),
                  amount=q2(amount), discount_amount=q2(discount), total=total, paid_amount=ZERO,
                  status=InvoiceStatus.UNPAID,
                  due_date=due_date or (month_start(period_month) + timedelta(days=due_days)))
    db.add(inv)
    await db.flush()
    if total > 0:
        await add_ledger(db, student_id, BalanceTxnType.CHARGE, -total, "invoice", inv.id, user)
    await recompute_invoices(db, student_id)
    return inv


async def generate_for_enrollment(db, user, enr: Enrollment, period_month, due_days: int) -> Invoice | None:
    if not eligible_for_month(enr, period_month):
        return None
    exists = await db.scalar(select(Invoice.id).where(
        Invoice.enrollment_id == enr.id, Invoice.period_month == month_start(period_month)))
    if exists:
        return None
    disc = await compute_discount(db, enr.student_id, enr.id, period_month, enr.price)
    return await create_invoice(db, user, student_id=enr.student_id, enrollment_id=enr.id,
                                period_month=period_month, amount=enr.price, discount=disc, due_days=due_days)


async def cancel_invoice(db, user, inv: Invoice):
    if inv.status == InvoiceStatus.CANCELLED:
        raise HTTPException(409, "Hisob allaqachon bekor qilingan")
    await lock_student(db, inv.student_id)
    inv.status = InvoiceStatus.CANCELLED
    if inv.total > 0:  # charge ni teskari yozuv bilan qaytaramiz
        await add_ledger(db, inv.student_id, BalanceTxnType.CHARGE, inv.total, "invoice_cancel", inv.id, user)
    inv.paid_amount = ZERO
    await recompute_invoices(db, inv.student_id)


async def register_payment(db, user, *, student_id: int, method, amount: Decimal, invoice_id: int | None,
                           transaction_id: str | None, paid_at, note: str | None, status: PaymentStatus) -> Payment:
    student = await lock_student(db, student_id)
    if invoice_id is not None:
        inv = await db.get(Invoice, invoice_id)
        if inv is None or inv.student_id != student.id:
            raise HTTPException(400, "Hisob topilmadi yoki boshqa o'quvchiga tegishli")
        if inv.status == InvoiceStatus.CANCELLED:
            raise HTTPException(400, "Bekor qilingan hisobga to'lov qilib bo'lmaydi")
    if method.is_online and not transaction_id:
        raise HTTPException(400, "Onlayn to'lov uchun transaction_id majburiy")
    pay = Payment(student_id=student_id, invoice_id=invoice_id, method_id=method.id, amount=q2(amount),
                  transaction_id=transaction_id, paid_at=paid_at or utcnow(), note=note, status=status,
                  received_by=None if method.is_online else user.id)  # naqd: kassa nazorati
    db.add(pay)
    await db.flush()
    if status == PaymentStatus.COMPLETED:
        await add_ledger(db, student_id, BalanceTxnType.PAYMENT, pay.amount, "payment", pay.id, user)
        await recompute_invoices(db, student_id)
    return pay


async def confirm_payment(db, user, pay: Payment):
    if pay.status != PaymentStatus.PENDING:
        raise HTTPException(409, "Faqat kutilayotgan to'lovni tasdiqlash mumkin")
    pay.status = PaymentStatus.COMPLETED
    await add_ledger(db, pay.student_id, BalanceTxnType.PAYMENT, pay.amount, "payment", pay.id, user)
    await recompute_invoices(db, pay.student_id)


async def refund_payment(db, user, pay: Payment):
    if pay.status != PaymentStatus.COMPLETED:
        raise HTTPException(409, "Faqat yakunlangan to'lovni qaytarish mumkin")
    if pay.is_refunded:
        raise HTTPException(409, "To'lov allaqachon qaytarilgan")
    await lock_student(db, pay.student_id)
    pay.is_refunded = True
    pay.refunded_at = utcnow()
    await add_ledger(db, pay.student_id, BalanceTxnType.REFUND, -pay.amount, "payment", pay.id, user)
    await recompute_invoices(db, pay.student_id)
