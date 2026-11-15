"""Click (Shop API) va Payme (Merchant API) integratsiyasi.

Buyurtma raqami (order id) = payments.id. Oqim:
  1) Xodim /payments/online/checkout bilan `pending` to'lov va to'lov havolasini yaratadi.
  2) Click/Payme webhooklari tranzaksiyani yaratadi/bajaradi/bekor qiladi (provider_transactions jadvali).
  3) Bajarilganda services.finance.confirm_payment — ledger, balans va hisoblar yangilanadi.
Hamma webhook javoblari HTTP 200 va protokol bo'yicha xato kodi bilan qaytadi."""
import base64
import hashlib
import hmac
import logging
import urllib.parse
from decimal import Decimal, InvalidOperation
from fastapi import HTTPException
from sqlalchemy import select
from app.models.enums import PaymentStatus
from app.models.finance import Invoice, Payment, PaymentMethod
from app.models.online import ProviderTransaction as Tx
from app.services.finance import confirm_payment, refund_payment, q2
from app.utils.audit import add_audit
from app.utils.config import settings
from app.utils.time import utcnow

log = logging.getLogger("online_payments")
PAYME_TIMEOUT_MS = 12 * 3600 * 1000  # yaratilgan tranzaksiya 12 soatda bajarilmasa bekor qilinadi


def ms(d) -> int:
    from datetime import timezone
    return 0 if d is None else int(d.replace(tzinfo=timezone.utc).timestamp() * 1000)


def click_configured() -> bool:
    return bool(settings.CLICK_SERVICE_ID and settings.CLICK_MERCHANT_ID and settings.CLICK_SECRET_KEY)


def payme_configured() -> bool:
    return bool(settings.PAYME_MERCHANT_ID and settings.PAYME_KEY)


# ======================= Checkout (to'lov havolasi) =======================
def click_url(pay: Payment, return_url: str | None) -> str:
    q = {"service_id": settings.CLICK_SERVICE_ID, "merchant_id": settings.CLICK_MERCHANT_ID,
         "amount": f"{pay.amount:.2f}", "transaction_param": str(pay.id)}
    if return_url:
        q["return_url"] = return_url
    return "https://my.click.uz/services/pay?" + urllib.parse.urlencode(q)


def payme_url(pay: Payment, return_url: str | None) -> str:
    tiyin = int(q2(pay.amount) * 100)
    params = f"m={settings.PAYME_MERCHANT_ID};ac.order_id={pay.id};a={tiyin}" + (f";c={return_url}" if return_url else "")
    return f"{settings.PAYME_CHECKOUT_URL.rstrip('/')}/{base64.b64encode(params.encode()).decode()}"


async def create_checkout(db, user, *, student, provider: str, amount: Decimal, invoice_id: int | None, return_url: str | None):
    if provider == "click" and not click_configured():
        raise HTTPException(400, "Click sozlanmagan (CLICK_SERVICE_ID, CLICK_MERCHANT_ID, CLICK_SECRET_KEY)")
    if provider == "payme" and not payme_configured():
        raise HTTPException(400, "Payme sozlanmagan (PAYME_MERCHANT_ID, PAYME_KEY)")
    method = await db.scalar(select(PaymentMethod).where(PaymentMethod.code == provider))
    if method is None:
        raise HTTPException(400, f"'{provider}' to'lov usuli bazada yo'q (python -m app.seed)")
    if invoice_id is not None:
        inv = await db.get(Invoice, invoice_id)
        if inv is None or inv.student_id != student.id:
            raise HTTPException(400, "Hisob topilmadi yoki boshqa o'quvchiga tegishli")
        if inv.status.value == "cancelled":
            raise HTTPException(400, "Bekor qilingan hisobga to'lov qilib bo'lmaydi")
    pay = Payment(student_id=student.id, invoice_id=invoice_id, method_id=method.id, amount=q2(amount), status=PaymentStatus.PENDING,
                  received_by=None, note=f"Onlayn to'lov havolasi ({provider})")
    db.add(pay)
    await db.flush()
    add_audit(db, user, "create", "online_payment", pay.id, new={"provider": provider, "amount": str(pay.amount)})
    return pay, (click_url(pay, return_url) if provider == "click" else payme_url(pay, return_url))


# ======================= Umumiy =======================
async def _method_code(db, pay: Payment) -> str | None:
    m = await db.get(PaymentMethod, pay.method_id)
    return m.code if m else None


async def _lock_payment(db, payment_id: int) -> Payment | None:
    return await db.get(Payment, payment_id, with_for_update=True, populate_existing=True)


async def _find_tx(db, provider: str, trans_id: str) -> Tx | None:
    return (await db.execute(select(Tx).where(Tx.provider == provider, Tx.provider_trans_id == str(trans_id))
                             .with_for_update())).scalar_one_or_none()


async def _perform(db, tx: Tx, pay: Payment):
    pay.transaction_id = tx.provider_trans_id
    await confirm_payment(db, None, pay)
    tx.state, tx.perform_time = 2, utcnow()
    add_audit(db, None, "online_confirm", "payment", pay.id, new={"provider": tx.provider, "trans_id": tx.provider_trans_id, "amount": str(pay.amount)})


def _cancel_pending(tx: Tx, pay: Payment, reason: int | None):
    tx.state, tx.cancel_time, tx.reason = -1, utcnow(), reason
    if pay.status == PaymentStatus.PENDING:
        pay.status = PaymentStatus.FAILED


# ======================= CLICK =======================
CLICK_ERR = {0: "Success", -1: "SIGN CHECK FAILED!", -2: "Incorrect parameter amount", -3: "Action not found", -4: "Already paid",
             -5: "User does not exist", -6: "Transaction does not exist", -7: "Failed to update user",
             -8: "Error in request from click", -9: "Transaction cancelled"}


def click_sign(p: dict, secret: str, complete: bool) -> str:
    parts = [p["click_trans_id"], p["service_id"], secret, p["merchant_trans_id"]]
    if complete:
        parts.append(p.get("merchant_prepare_id", ""))
    parts += [p["amount"], p["action"], p["sign_time"]]
    return hashlib.md5("".join(parts).encode()).hexdigest()


def _int(v, default=0):
    try:
        return int(v)
    except (TypeError, ValueError):
        return default


async def handle_click(db, form: dict) -> dict:
    def resp(code: int, note: str | None = None, **extra) -> dict:
        d = {"click_trans_id": _int(form.get("click_trans_id")), "merchant_trans_id": form.get("merchant_trans_id"),
             "error": code, "error_note": note or CLICK_ERR[code]}
        d.update(extra)
        return d

    secret = settings.CLICK_SECRET_KEY
    if not secret:
        return resp(-8, "Click sozlanmagan")
    required = ("click_trans_id", "service_id", "merchant_trans_id", "amount", "action", "sign_time", "sign_string")
    if any(k not in form for k in required):
        return resp(-8)
    action = _int(form["action"], -99)
    if action not in (0, 1):
        return resp(-3)
    complete = action == 1
    if complete and "merchant_prepare_id" not in form:
        return resp(-8)
    if not hmac.compare_digest(click_sign(form, secret, complete), form["sign_string"].lower()):
        return resp(-1)

    pay = await _lock_payment(db, _int(form["merchant_trans_id"], -1))
    if pay is None or await _method_code(db, pay) != "click":
        return resp(-5)
    try:
        amount = Decimal(form["amount"])
    except InvalidOperation:
        return resp(-2)
    if q2(amount) != q2(pay.amount):
        return resp(-2)

    trans_id = str(form["click_trans_id"])
    if not complete:  # ---- PREPARE ----
        existing = await _find_tx(db, "click", trans_id)
        if pay.status == PaymentStatus.COMPLETED or (existing and existing.state == 2):
            return resp(-4)
        if pay.status == PaymentStatus.FAILED or (existing and existing.state < 0):
            return resp(-9)
        if existing:
            return resp(0, merchant_prepare_id=existing.id)
        for old in (await db.execute(select(Tx).where(Tx.payment_id == pay.id, Tx.state == 1))).scalars().all():
            old.state, old.cancel_time = -1, utcnow()  # mijoz avvalgi urinishni tashlab ketgan
        tx = Tx(provider="click", provider_trans_id=trans_id, payment_id=pay.id, amount=pay.amount, state=1)
        db.add(tx)
        await db.flush()
        return resp(0, merchant_prepare_id=tx.id)

    # ---- COMPLETE ----
    tx = await db.get(Tx, _int(form["merchant_prepare_id"], -1), with_for_update=True, populate_existing=True)
    if tx is None or tx.provider != "click" or tx.payment_id != pay.id or tx.provider_trans_id != trans_id:
        return resp(-6)
    if tx.state == 2 or pay.status == PaymentStatus.COMPLETED:
        return resp(-4)
    if tx.state < 0 or pay.status == PaymentStatus.FAILED:
        return resp(-9)
    if _int(form.get("error", 0)) < 0:  # Click o'z tomonida to'lov xato bo'lganini bildirdi
        _cancel_pending(tx, pay, _int(form.get("error")))
        return resp(-9)
    await _perform(db, tx, pay)
    return resp(0, merchant_confirm_id=tx.id)


# ======================= PAYME =======================
class PaymeError(Exception):
    def __init__(self, code: int, ru: str, uz: str, en: str, data: str | None = None):
        self.code, self.message, self.data = code, {"ru": ru, "uz": uz, "en": en}, data


E_AUTH = (-32504, "Недостаточно привилегий для выполнения метода", "Usulni bajarish uchun huquq yetarli emas", "Insufficient privilege to perform this method")
E_AMOUNT = (-31001, "Неверная сумма", "Noto'g'ri summa", "Wrong amount")
E_NO_TX = (-31003, "Транзакция не найдена", "Tranzaksiya topilmadi", "Transaction not found")
E_CANT_CANCEL = (-31007, "Невозможно отменить транзакцию", "Tranzaksiyani bekor qilib bo'lmaydi", "Unable to cancel transaction")
E_CANT = (-31008, "Невозможно выполнить операцию", "Amalni bajarib bo'lmaydi", "Unable to perform operation")
E_NO_ORDER = (-31050, "Заказ не найден", "Buyurtma topilmadi", "Order not found")
E_NOT_PAYABLE = (-31051, "Заказ не может быть оплачен", "Buyurtmani to'lab bo'lmaydi", "Order cannot be paid")


def _raise(e: tuple, data: str | None = None):
    raise PaymeError(*e, data=data)


def payme_authorized(header: str | None) -> bool:
    if not payme_configured() or not header or not header.lower().startswith("basic "):
        return False
    try:
        login, _, password = base64.b64decode(header[6:]).decode().partition(":")
    except Exception:  # noqa: BLE001
        return False
    return hmac.compare_digest(login, "Paycom") and hmac.compare_digest(password, settings.PAYME_KEY)


async def _payme_order(db, params: dict) -> Payment:
    oid = (params.get("account") or {}).get("order_id")
    try:
        pid = int(oid)
    except (TypeError, ValueError):
        _raise(E_NO_ORDER, "order_id")
    pay = await _lock_payment(db, pid)
    if pay is None or await _method_code(db, pay) != "payme":
        _raise(E_NO_ORDER, "order_id")
    if params.get("amount") != int(q2(pay.amount) * 100):
        _raise(E_AMOUNT, "amount")
    if pay.status != PaymentStatus.PENDING:
        _raise(E_NOT_PAYABLE, "order_id")
    return pay


def _expired(tx: Tx) -> bool:
    return ms(utcnow()) - ms(tx.created_at) > PAYME_TIMEOUT_MS


async def _m_check_perform(db, p: dict) -> dict:
    await _payme_order(db, p)
    return {"allow": True}


async def _m_create(db, p: dict) -> dict:
    tid = p.get("id")
    if not tid:
        _raise(E_CANT, "id")
    tx = await _find_tx(db, "payme", tid)
    if tx is not None:
        if tx.state != 1:
            _raise(E_CANT)
        if _expired(tx):
            _cancel_pending(tx, await _lock_payment(db, tx.payment_id), 4)
            await db.commit()  # bekor qilish saqlansin, keyin xato qaytadi
            _raise(E_CANT)
        return {"create_time": ms(tx.created_at), "transaction": str(tx.id), "state": 1}
    pay = await _payme_order(db, p)
    if (await db.execute(select(Tx.id).where(Tx.payment_id == pay.id, Tx.state == 1))).first():
        _raise(E_CANT, "order_id")  # buyurtmada boshqa faol tranzaksiya bor
    tx = Tx(provider="payme", provider_trans_id=str(tid), payment_id=pay.id, amount=pay.amount, state=1, provider_time=p.get("time"))
    db.add(tx)
    await db.flush()
    return {"create_time": ms(tx.created_at), "transaction": str(tx.id), "state": 1}


async def _m_perform(db, p: dict) -> dict:
    tx = await _find_tx(db, "payme", p.get("id"))
    if tx is None:
        _raise(E_NO_TX)
    if tx.state == 2:
        return {"transaction": str(tx.id), "perform_time": ms(tx.perform_time), "state": 2}
    if tx.state != 1:
        _raise(E_CANT)
    pay = await _lock_payment(db, tx.payment_id)
    if _expired(tx):
        _cancel_pending(tx, pay, 4)
        await db.commit()
        _raise(E_CANT)
    await _perform(db, tx, pay)
    return {"transaction": str(tx.id), "perform_time": ms(tx.perform_time), "state": 2}


async def _m_cancel(db, p: dict) -> dict:
    tx = await _find_tx(db, "payme", p.get("id"))
    if tx is None:
        _raise(E_NO_TX)
    pay = await _lock_payment(db, tx.payment_id)
    if tx.state == 1:
        _cancel_pending(tx, pay, p.get("reason"))
    elif tx.state == 2:  # bajarilgan to'lovni qaytarish
        try:
            await refund_payment(db, None, pay)
        except HTTPException:
            _raise(E_CANT_CANCEL)
        tx.state, tx.cancel_time, tx.reason = -2, utcnow(), p.get("reason")
        add_audit(db, None, "online_refund", "payment", pay.id, new={"provider": "payme", "reason": p.get("reason")})
    return {"transaction": str(tx.id), "cancel_time": ms(tx.cancel_time), "state": tx.state}


def _tx_view(tx: Tx, pay_account: bool = False) -> dict:
    d = {"create_time": ms(tx.created_at), "perform_time": ms(tx.perform_time), "cancel_time": ms(tx.cancel_time),
         "transaction": str(tx.id), "state": tx.state, "reason": tx.reason}
    return d


async def _m_check(db, p: dict) -> dict:
    tx = await _find_tx(db, "payme", p.get("id"))
    if tx is None:
        _raise(E_NO_TX)
    return _tx_view(tx)


async def _m_statement(db, p: dict) -> dict:
    lo, hi = _int(p.get("from")), _int(p.get("to"))
    out = []
    for tx in (await db.execute(select(Tx).where(Tx.provider == "payme").order_by(Tx.id))).scalars().all():
        if lo <= ms(tx.created_at) <= hi:
            out.append({"id": tx.provider_trans_id, "time": tx.provider_time or ms(tx.created_at), "amount": int(q2(tx.amount) * 100),
                        "account": {"order_id": str(tx.payment_id)}, **_tx_view(tx)})
    return {"transactions": out}


_PAYME_METHODS = {"CheckPerformTransaction": _m_check_perform, "CreateTransaction": _m_create, "PerformTransaction": _m_perform,
                  "CancelTransaction": _m_cancel, "CheckTransaction": _m_check, "GetStatement": _m_statement}


async def handle_payme(db, body: dict, auth_header: str | None) -> dict:
    rid = body.get("id") if isinstance(body, dict) else None
    try:
        if not payme_authorized(auth_header):
            _raise(E_AUTH)
        fn = _PAYME_METHODS.get(body.get("method"))
        if fn is None:
            raise PaymeError(-32601, "Метод не найден", "Usul topilmadi", "Method not found", body.get("method"))
        return {"jsonrpc": "2.0", "id": rid, "result": await fn(db, body.get("params") or {})}
    except PaymeError as e:
        return {"jsonrpc": "2.0", "id": rid, "error": {"code": e.code, "message": e.message, "data": e.data}}
