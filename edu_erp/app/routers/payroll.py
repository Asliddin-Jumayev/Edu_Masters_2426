from decimal import Decimal
from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select
from app.models.employees import Employee
from app.models.enums import PayrollStatus
from app.models.payroll import Payroll, SalaryRule
from app.schemes.payroll import (PayrollAdjust, PayrollCalculate, PayrollResponse, SalaryRuleCreate,
                                 SalaryRuleResponse)
from app.schemes.common import Message
from app.services.finance import q2
from app.services.payroll import calculate
from app.utils.access import ensure_branch, has_role, scoped
from app.utils.audit import add_audit, snapshot
from app.utils.checked import check_ident, safe_commit
from app.utils.deps import MyDb
from app.utils.pagination import Page, Pagination, paginate
from app.utils.permissions import AccountantUser, AuthUser, FinanceUser
from app.utils.roles import ACCOUNTANT, ADMIN, MANAGER
from app.utils.time import month_start, utcnow

rules_router = APIRouter(prefix="/salary-rules", tags=["Payroll"])
router = APIRouter(prefix="/payrolls", tags=["Payroll"])


async def _emp(db, user, employee_id: int) -> Employee:
    e = await check_ident(db, Employee, employee_id, "Xodim topilmadi")
    ensure_branch(user, e.branch_id)
    return e


@rules_router.post("/", response_model=SalaryRuleResponse, status_code=201)
async def create_rule(data: SalaryRuleCreate, db: MyDb, user: AccountantUser):
    await _emp(db, user, data.employee_id)
    obj = SalaryRule(**data.model_dump())
    db.add(obj)
    await db.flush()
    add_audit(db, user, "create", "salary_rule", obj.id, new=snapshot(obj))
    await safe_commit(db)
    return obj


@rules_router.get("/", response_model=list[SalaryRuleResponse])
async def list_rules(db: MyDb, user: FinanceUser, employee_id: int | None = None):
    stmt = select(SalaryRule).order_by(SalaryRule.employee_id, SalaryRule.effective_from.desc())
    if employee_id is not None:
        await _emp(db, user, employee_id)
        stmt = stmt.where(SalaryRule.employee_id == employee_id)
    return (await db.execute(stmt)).scalars().all()


@rules_router.delete("/{rule_id}", response_model=Message)
async def delete_rule(rule_id: int, db: MyDb, user: AccountantUser):
    r = await check_ident(db, SalaryRule, rule_id, "Qoida topilmadi")
    await _emp(db, user, r.employee_id)
    add_audit(db, user, "delete", "salary_rule", r.id, old=snapshot(r))
    await db.delete(r)
    await safe_commit(db)
    return Message(msg="Qoida o'chirildi")


@router.post("/calculate", response_model=list[PayrollResponse])
async def calculate_payrolls(data: PayrollCalculate, db: MyDb, user: AccountantUser):
    """Oy uchun maoshni hisoblaydi. Faqat 'draft' qayta hisoblanadi; bonus/jarima saqlanadi."""
    if data.employee_id is not None:
        await _emp(db, user, data.employee_id)
        ids = [data.employee_id]
    else:
        ids = [i for i in (await db.execute(select(SalaryRule.employee_id).distinct())).scalars().all()]
    out = []
    for emp_id in ids:
        emp = await db.get(Employee, emp_id)
        try:
            ensure_branch(user, emp.branch_id)
        except HTTPException:
            continue
        lessons, base = await calculate(db, emp_id, data.period_month)
        p = await db.scalar(select(Payroll).where(Payroll.employee_id == emp_id,
                                                  Payroll.period_month == data.period_month))
        if p is None:
            p = Payroll(employee_id=emp_id, period_month=data.period_month, lessons_count=lessons,
                        base_amount=base, bonus=Decimal("0"), penalty=Decimal("0"), total=base,
                        status=PayrollStatus.DRAFT)
            db.add(p)
        elif p.status == PayrollStatus.DRAFT:
            p.lessons_count, p.base_amount = lessons, base
            p.total = q2(base + p.bonus - p.penalty)
        out.append(p)
    await db.flush()
    add_audit(db, user, "calculate", "payroll", None, new={"period_month": data.period_month.isoformat(),
                                                           "employees": len(out)})
    await safe_commit(db)
    return out


@router.get("/", response_model=Page[PayrollResponse])
async def list_payrolls(db: MyDb, user: AuthUser, params: Pagination, employee_id: int | None = None,
                        period_month: str | None = None,
                        status_: PayrollStatus | None = Query(None, alias="status")):
    stmt = (select(Payroll).join(Employee, Employee.id == Payroll.employee_id)
            .order_by(Payroll.period_month.desc(), Payroll.id.desc()))
    stmt = scoped(stmt, Employee.branch_id, user)
    if has_role(user, ADMIN, MANAGER, ACCOUNTANT):
        if employee_id is not None:
            await _emp(db, user, employee_id)
            stmt = stmt.where(Payroll.employee_id == employee_id)
    else:  # o'qituvchi faqat o'z maoshini ko'radi
        stmt = stmt.where(Payroll.employee_id == user.id)
    if period_month:
        import datetime as dt
        stmt = stmt.where(Payroll.period_month == month_start(dt.date.fromisoformat(period_month)))
    if status_ is not None:
        stmt = stmt.where(Payroll.status == status_)
    return await paginate(db, stmt, params)


async def _payroll(db, user, payroll_id: int) -> Payroll:
    p = await check_ident(db, Payroll, payroll_id, "Maosh yozuvi topilmadi")
    await _emp(db, user, p.employee_id)
    return p


@router.patch("/{payroll_id}", response_model=PayrollResponse)
async def adjust(payroll_id: int, data: PayrollAdjust, db: MyDb, user: AccountantUser):
    p = await _payroll(db, user, payroll_id)
    if p.status != PayrollStatus.DRAFT:
        raise HTTPException(409, "Faqat 'draft' maoshni o'zgartirish mumkin")
    old = snapshot(p)
    if data.bonus is not None:
        p.bonus = data.bonus
    if data.penalty is not None:
        p.penalty = data.penalty
    p.total = q2(p.base_amount + p.bonus - p.penalty)
    if p.total < 0:
        raise HTTPException(400, "Jarima asosiy summa va bonusdan oshib ketdi")
    add_audit(db, user, "update", "payroll", p.id, old=old, new=snapshot(p))
    await safe_commit(db)
    return p


@router.post("/{payroll_id}/approve", response_model=PayrollResponse)
async def approve(payroll_id: int, db: MyDb, user: AccountantUser):
    p = await _payroll(db, user, payroll_id)
    if p.status != PayrollStatus.DRAFT:
        raise HTTPException(409, "Faqat 'draft' tasdiqlanadi")
    p.status, p.approved_by = PayrollStatus.APPROVED, user.id
    add_audit(db, user, "approve", "payroll", p.id, new={"total": str(p.total)})
    await safe_commit(db)
    return p


@router.post("/{payroll_id}/pay", response_model=PayrollResponse)
async def pay(payroll_id: int, db: MyDb, user: AccountantUser):
    p = await _payroll(db, user, payroll_id)
    if p.status != PayrollStatus.APPROVED:
        raise HTTPException(409, "Avval maoshni tasdiqlang")
    p.status, p.paid_at = PayrollStatus.PAID, utcnow()
    add_audit(db, user, "pay", "payroll", p.id, new={"total": str(p.total)})
    await safe_commit(db)
    return p
