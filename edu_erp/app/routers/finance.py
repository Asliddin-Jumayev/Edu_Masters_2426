import datetime as dt
from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select
from app.models.branches import Branch
from app.models.enums import EnrollmentStatus, InvoiceStatus, PaymentStatus
from app.models.finance import (Discount, Expense, ExpenseCategory, Invoice, Payment, PaymentMethod)
from app.models.groups import Group
from app.models.students import Enrollment, Student
from app.schemes.common import Message
from app.schemes.finance import (DiscountCreate, DiscountResponse, DiscountUpdate, ExpenseCategoryIn,
                                 ExpenseCategoryResponse, ExpenseCreate, ExpenseResponse, ExpenseUpdate,
                                 InvoiceCancel, InvoiceCreate, InvoiceGenerate, InvoiceGenerateResult,
                                 InvoiceResponse, PaymentCreate, PaymentMethodIn, PaymentMethodResponse,
                                 PaymentResponse)
from app.services import finance as svc
from app.utils.access import ensure_branch, scoped
from app.utils.audit import add_audit, snapshot
from app.utils.checked import check_ident, ensure_unique, safe_commit
from app.utils.config import settings
from app.utils.deps import MyDb
from app.utils.pagination import Page, Pagination, paginate
from app.utils.permissions import AccountantUser, AdminUser, FinanceUser
from app.utils.time import month_start, today, utcnow

# ---------------- to'lov usullari ----------------
methods_router = APIRouter(prefix="/payment-methods", tags=["Finance"])


@methods_router.get("/", response_model=list[PaymentMethodResponse])
async def list_methods(db: MyDb, user: FinanceUser):
    return (await db.execute(select(PaymentMethod).order_by(PaymentMethod.id))).scalars().all()


@methods_router.post("/", response_model=PaymentMethodResponse, status_code=201)
async def create_method(data: PaymentMethodIn, db: MyDb, user: AdminUser):
    await ensure_unique(db, PaymentMethod.code, data.code, msg="Bu kodli usul mavjud")
    obj = PaymentMethod(**data.model_dump())
    db.add(obj)
    await safe_commit(db)
    return obj


@methods_router.put("/{method_id}", response_model=PaymentMethodResponse)
async def update_method(method_id: int, data: PaymentMethodIn, db: MyDb, user: AdminUser):
    obj = await check_ident(db, PaymentMethod, method_id, "Usul topilmadi")
    await ensure_unique(db, PaymentMethod.code, data.code, exclude_id=obj.id, msg="Bu kodli usul mavjud")
    for k, v in data.model_dump().items():
        setattr(obj, k, v)
    await safe_commit(db)
    return obj


# ---------------- hisob-fakturalar ----------------
invoices_router = APIRouter(prefix="/invoices", tags=["Finance"])


async def _student(db, user, student_id: int) -> Student:
    s = await check_ident(db, Student, student_id, "O'quvchi topilmadi")
    ensure_branch(user, s.branch_id)
    return s


async def _invoice(db, user, invoice_id: int) -> Invoice:
    inv = await check_ident(db, Invoice, invoice_id, "Hisob topilmadi")
    await _student(db, user, inv.student_id)
    return inv


@invoices_router.post("/generate", response_model=InvoiceGenerateResult)
async def generate_invoices(data: InvoiceGenerate, db: MyDb, user: FinanceUser):
    """Oylik hisoblarni ommaviy yaratadi. Qayta chaqirilsa dublikat yaratmaydi."""
    stmt = (select(Enrollment).join(Group, Group.id == Enrollment.group_id)
            .where(Enrollment.status == EnrollmentStatus.ACTIVE).order_by(Enrollment.id))
    stmt = scoped(stmt, Group.branch_id, user)
    if data.group_id is not None:
        stmt = stmt.where(Enrollment.group_id == data.group_id)
    if data.branch_id is not None:
        ensure_branch(user, data.branch_id)
        stmt = stmt.where(Group.branch_id == data.branch_id)
    if data.student_id is not None:
        stmt = stmt.where(Enrollment.student_id == data.student_id)
    created = skipped = 0
    for enr in (await db.execute(stmt)).scalars().all():
        inv = await svc.generate_for_enrollment(db, user, enr, data.period_month, settings.INVOICE_DUE_DAYS)
        if inv is None:
            skipped += 1
        else:
            created += 1
    add_audit(db, user, "generate", "invoice", None,
              new={"period_month": data.period_month.isoformat(), "created": created})
    await safe_commit(db)
    return InvoiceGenerateResult(created=created, skipped_existing=skipped)


@invoices_router.post("/refresh-overdue", response_model=Message)
async def refresh_overdue(db: MyDb, user: AdminUser):
    n = await svc.mark_overdue(db)
    return Message(msg=f"{n} ta hisob 'overdue' qilindi")


@invoices_router.post("/", response_model=InvoiceResponse, status_code=201)
async def create_invoice(data: InvoiceCreate, db: MyDb, user: FinanceUser):
    student = await _student(db, user, data.student_id)
    if data.enrollment_id is not None:
        enr = await check_ident(db, Enrollment, data.enrollment_id, "Yozilish topilmadi")
        if enr.student_id != student.id:
            raise HTTPException(400, "Yozilish boshqa o'quvchiga tegishli")
    inv = await svc.create_invoice(db, user, student_id=student.id, enrollment_id=data.enrollment_id,
                                   period_month=data.period_month, amount=data.amount,
                                   discount=data.discount_amount, due_days=settings.INVOICE_DUE_DAYS,
                                   due_date=data.due_date)
    add_audit(db, user, "create", "invoice", inv.id, new=snapshot(inv))
    await safe_commit(db, "Bu yozilish uchun shu oyga hisob allaqachon mavjud")
    return inv


@invoices_router.get("/", response_model=Page[InvoiceResponse])
async def list_invoices(db: MyDb, user: FinanceUser, params: Pagination, student_id: int | None = None,
                        enrollment_id: int | None = None, group_id: int | None = None,
                        status_: InvoiceStatus | None = Query(None, alias="status"),
                        period_month: dt.date | None = None, branch_id: int | None = None):
    stmt = scoped(select(Invoice).join(Student, Student.id == Invoice.student_id), Student.branch_id, user)
    stmt = stmt.order_by(Invoice.id.desc())
    if branch_id is not None:
        stmt = stmt.where(Student.branch_id == branch_id)
    if student_id is not None:
        stmt = stmt.where(Invoice.student_id == student_id)
    if enrollment_id is not None:
        stmt = stmt.where(Invoice.enrollment_id == enrollment_id)
    if group_id is not None:
        stmt = stmt.where(Invoice.enrollment_id.in_(select(Enrollment.id).where(Enrollment.group_id == group_id)))
    if status_ is not None:
        stmt = stmt.where(Invoice.status == status_)
    if period_month is not None:
        stmt = stmt.where(Invoice.period_month == month_start(period_month))
    return await paginate(db, stmt, params)


@invoices_router.get("/{invoice_id}", response_model=InvoiceResponse)
async def get_invoice(invoice_id: int, db: MyDb, user: FinanceUser):
    return await _invoice(db, user, invoice_id)


@invoices_router.post("/{invoice_id}/cancel", response_model=InvoiceResponse)
async def cancel_invoice(invoice_id: int, data: InvoiceCancel, db: MyDb, user: AccountantUser):
    inv = await _invoice(db, user, invoice_id)
    old = snapshot(inv)
    await svc.cancel_invoice(db, user, inv)
    add_audit(db, user, "cancel", "invoice", inv.id, old=old, new={"reason": data.reason})
    await safe_commit(db)
    return inv


# ---------------- to'lovlar ----------------
payments_router = APIRouter(prefix="/payments", tags=["Finance"])


async def _payment(db, user, payment_id: int) -> Payment:
    p = await check_ident(db, Payment, payment_id, "To'lov topilmadi")
    await _student(db, user, p.student_id)
    return p


@payments_router.post("/", response_model=PaymentResponse, status_code=201)
async def create_payment(data: PaymentCreate, db: MyDb, user: FinanceUser):
    student = await _student(db, user, data.student_id)
    method = await check_ident(db, PaymentMethod, data.method_id, "To'lov usuli topilmadi")
    if data.transaction_id:
        if await db.scalar(select(Payment.id).where(Payment.method_id == method.id,
                                                    Payment.transaction_id == data.transaction_id)):
            raise HTTPException(409, "Bu tranzaksiya raqami allaqachon qayd etilgan")
    if data.status == PaymentStatus.FAILED:
        raise HTTPException(400, "Muvaffaqiyatsiz to'lovni qo'lda kiritib bo'lmaydi")
    pay = await svc.register_payment(db, user, student_id=student.id, method=method, amount=data.amount,
                                     invoice_id=data.invoice_id, transaction_id=data.transaction_id,
                                     paid_at=data.paid_at, note=data.note, status=data.status)
    add_audit(db, user, "create", "payment", pay.id, new=snapshot(pay))
    await safe_commit(db)
    return pay


@payments_router.get("/", response_model=Page[PaymentResponse])
async def list_payments(db: MyDb, user: FinanceUser, params: Pagination, student_id: int | None = None,
                        method_id: int | None = None, invoice_id: int | None = None,
                        status_: PaymentStatus | None = Query(None, alias="status"),
                        date_from: dt.date | None = None, date_to: dt.date | None = None,
                        branch_id: int | None = None):
    stmt = scoped(select(Payment).join(Student, Student.id == Payment.student_id), Student.branch_id, user)
    stmt = stmt.order_by(Payment.id.desc())
    if branch_id is not None:
        stmt = stmt.where(Student.branch_id == branch_id)
    for col, val in ((Payment.student_id, student_id), (Payment.method_id, method_id),
                     (Payment.invoice_id, invoice_id)):
        if val is not None:
            stmt = stmt.where(col == val)
    if status_ is not None:
        stmt = stmt.where(Payment.status == status_)
    if date_from:
        stmt = stmt.where(Payment.paid_at >= dt.datetime.combine(date_from, dt.time.min))
    if date_to:
        stmt = stmt.where(Payment.paid_at <= dt.datetime.combine(date_to, dt.time.max))
    return await paginate(db, stmt, params)


@payments_router.get("/{payment_id}", response_model=PaymentResponse)
async def get_payment(payment_id: int, db: MyDb, user: FinanceUser):
    return await _payment(db, user, payment_id)


@payments_router.post("/{payment_id}/confirm", response_model=PaymentResponse)
async def confirm_payment(payment_id: int, db: MyDb, user: AccountantUser):
    p = await _payment(db, user, payment_id)
    await svc.confirm_payment(db, user, p)
    add_audit(db, user, "confirm", "payment", p.id)
    await safe_commit(db)
    return p


@payments_router.post("/{payment_id}/refund", response_model=PaymentResponse)
async def refund_payment(payment_id: int, db: MyDb, user: AccountantUser):
    p = await _payment(db, user, payment_id)
    await svc.refund_payment(db, user, p)
    add_audit(db, user, "refund", "payment", p.id, new={"amount": str(p.amount)})
    await safe_commit(db)
    return p


# ---------------- chegirmalar ----------------
discounts_router = APIRouter(prefix="/discounts", tags=["Finance"])


@discounts_router.post("/", response_model=DiscountResponse, status_code=201)
async def create_discount(data: DiscountCreate, db: MyDb, user: FinanceUser):
    student = await _student(db, user, data.student_id)
    if data.enrollment_id is not None:
        enr = await check_ident(db, Enrollment, data.enrollment_id, "Yozilish topilmadi")
        if enr.student_id != student.id:
            raise HTTPException(400, "Yozilish boshqa o'quvchiga tegishli")
    obj = Discount(**data.model_dump(exclude={"valid_from"}), valid_from=data.valid_from or today(),
                   created_by=user.id)
    db.add(obj)
    await db.flush()
    add_audit(db, user, "create", "discount", obj.id, new=snapshot(obj))
    await safe_commit(db)
    return obj


@discounts_router.get("/", response_model=list[DiscountResponse])
async def list_discounts(db: MyDb, user: FinanceUser, student_id: int):
    await _student(db, user, student_id)
    return (await db.execute(select(Discount).where(Discount.student_id == student_id)
                             .order_by(Discount.id.desc()))).scalars().all()


@discounts_router.put("/{discount_id}", response_model=DiscountResponse)
async def update_discount(discount_id: int, data: DiscountUpdate, db: MyDb, user: FinanceUser):
    d = await check_ident(db, Discount, discount_id, "Chegirma topilmadi")
    await _student(db, user, d.student_id)
    ch = data.model_dump(exclude_unset=True)
    if ch.get("value") and d.type.value == "percent" and ch["value"] > 100:
        raise HTTPException(400, "Foiz 100 dan oshmasligi kerak")
    old = snapshot(d)
    for k, v in ch.items():
        setattr(d, k, v)
    add_audit(db, user, "update", "discount", d.id, old=old, new=snapshot(d))
    await safe_commit(db)
    return d


@discounts_router.delete("/{discount_id}", response_model=Message)
async def delete_discount(discount_id: int, db: MyDb, user: FinanceUser):
    """Yozilgan hisoblar o'zgarmaydi; faqat kelgusi hisoblarga ta'sir qilmaydi."""
    d = await check_ident(db, Discount, discount_id, "Chegirma topilmadi")
    await _student(db, user, d.student_id)
    add_audit(db, user, "delete", "discount", d.id, old=snapshot(d))
    await db.delete(d)
    await safe_commit(db)
    return Message(msg="Chegirma o'chirildi")


# ---------------- xarajatlar ----------------
expenses_router = APIRouter(prefix="/expenses", tags=["Finance"])
categories_router = APIRouter(prefix="/expense-categories", tags=["Finance"])


@categories_router.get("/", response_model=list[ExpenseCategoryResponse])
async def list_categories(db: MyDb, user: FinanceUser):
    return (await db.execute(select(ExpenseCategory).order_by(ExpenseCategory.name))).scalars().all()


@categories_router.post("/", response_model=ExpenseCategoryResponse, status_code=201)
async def create_category(data: ExpenseCategoryIn, db: MyDb, user: FinanceUser):
    await ensure_unique(db, ExpenseCategory.name, data.name, msg="Bunday kategoriya mavjud")
    obj = ExpenseCategory(**data.model_dump())
    db.add(obj)
    await safe_commit(db)
    return obj


@categories_router.put("/{cat_id}", response_model=ExpenseCategoryResponse)
async def update_category(cat_id: int, data: ExpenseCategoryIn, db: MyDb, user: FinanceUser):
    obj = await check_ident(db, ExpenseCategory, cat_id, "Kategoriya topilmadi")
    await ensure_unique(db, ExpenseCategory.name, data.name, exclude_id=obj.id, msg="Bunday kategoriya mavjud")
    obj.name = data.name
    await safe_commit(db)
    return obj


@categories_router.delete("/{cat_id}", response_model=Message)
async def delete_category(cat_id: int, db: MyDb, user: FinanceUser):
    obj = await check_ident(db, ExpenseCategory, cat_id, "Kategoriya topilmadi")
    if await db.scalar(select(Expense.id).where(Expense.category_id == obj.id).limit(1)):
        raise HTTPException(409, "Kategoriyada xarajatlar bor")
    await db.delete(obj)
    await safe_commit(db)
    return Message(msg="Kategoriya o'chirildi")


async def _expense(db, user, expense_id: int) -> Expense:
    e = await check_ident(db, Expense, expense_id, "Xarajat topilmadi")
    ensure_branch(user, e.branch_id)
    return e


@expenses_router.post("/", response_model=ExpenseResponse, status_code=201)
async def create_expense(data: ExpenseCreate, db: MyDb, user: FinanceUser):
    ensure_branch(user, data.branch_id)
    await check_ident(db, Branch, data.branch_id, "Filial topilmadi")
    await check_ident(db, ExpenseCategory, data.category_id, "Kategoriya topilmadi")
    obj = Expense(**data.model_dump(), created_by=user.id)
    db.add(obj)
    await db.flush()
    add_audit(db, user, "create", "expense", obj.id, new=snapshot(obj))
    await safe_commit(db)
    return obj


@expenses_router.get("/", response_model=Page[ExpenseResponse])
async def list_expenses(db: MyDb, user: FinanceUser, params: Pagination, branch_id: int | None = None,
                        category_id: int | None = None, date_from: dt.date | None = None,
                        date_to: dt.date | None = None):
    stmt = scoped(select(Expense), Expense.branch_id, user).order_by(Expense.spent_at.desc(), Expense.id.desc())
    if branch_id is not None:
        stmt = stmt.where(Expense.branch_id == branch_id)
    if category_id is not None:
        stmt = stmt.where(Expense.category_id == category_id)
    if date_from:
        stmt = stmt.where(Expense.spent_at >= date_from)
    if date_to:
        stmt = stmt.where(Expense.spent_at <= date_to)
    return await paginate(db, stmt, params)


@expenses_router.put("/{expense_id}", response_model=ExpenseResponse)
async def update_expense(expense_id: int, data: ExpenseUpdate, db: MyDb, user: FinanceUser):
    e = await _expense(db, user, expense_id)
    ch = data.model_dump(exclude_unset=True)
    if ch.get("category_id"):
        await check_ident(db, ExpenseCategory, ch["category_id"], "Kategoriya topilmadi")
    old = snapshot(e)
    for k, v in ch.items():
        setattr(e, k, v)
    add_audit(db, user, "update", "expense", e.id, old=old, new=snapshot(e))
    await safe_commit(db)
    return e


@expenses_router.delete("/{expense_id}", response_model=Message)
async def delete_expense(expense_id: int, db: MyDb, user: AccountantUser):
    e = await _expense(db, user, expense_id)
    add_audit(db, user, "delete", "expense", e.id, old=snapshot(e))
    await db.delete(e)
    await safe_commit(db)
    return Message(msg="Xarajat o'chirildi")
