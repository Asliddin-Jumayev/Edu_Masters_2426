import datetime as dt
from decimal import Decimal
from fastapi import APIRouter, Response
from sqlalchemy import func, select
from app.models.crm import Lead, LeadSource, LeadStatus
from app.models.enums import EnrollmentStatus, GroupStatus, PaymentStatus, SessionStatus, StudentStatus
from app.models.finance import Expense, ExpenseCategory, Payment
from app.models.groups import Group
from app.models.lessons import LessonSession
from app.models.students import Student
from app.services.excel_export import export_debtors_to_excel
from app.utils.access import branch_ids_for
from app.utils.cache import get as cache_get, set as cache_set
from app.utils.config import settings
from app.utils.deps import MyDb
from app.utils.permissions import FinanceUser
from app.utils.time import month_end, month_start, today

router = APIRouter(prefix="/reports", tags=["Reports"])
ZERO = Decimal("0")


def _in(stmt, col, ids):
    return stmt if ids is None else stmt.where(col.in_(ids))


def _range(date_from, date_to):
    start = date_from or month_start(today())
    return start, date_to or month_end(start)


@router.get("/dashboard")
async def dashboard(db: MyDb, user: FinanceUser, branch_id: int | None = None):
    ids = branch_ids_for(user, branch_id)
    cache_key = f"reports:dashboard:{user.id}:{branch_id or 'all'}:{sorted(ids) if ids else 'all'}"
    cached_val = await cache_get(cache_key)
    if cached_val is not None:
        return cached_val

    m_start, m_end = month_start(today()), month_end(today())
    t0, t1 = dt.datetime.combine(m_start, dt.time.min), dt.datetime.combine(m_end, dt.time.max)

    async def count(model, *conds, branch_col):
        return await db.scalar(_in(select(func.count(model.id)).where(*conds), branch_col, ids)) or 0

    income = await db.scalar(_in(
        select(func.coalesce(func.sum(Payment.amount), 0)).join(Student, Student.id == Payment.student_id)
        .where(Payment.status == PaymentStatus.COMPLETED, Payment.is_refunded.is_(False),
               Payment.paid_at >= t0, Payment.paid_at <= t1), Student.branch_id, ids))
    expenses = await db.scalar(_in(select(func.coalesce(func.sum(Expense.amount), 0))
                                   .where(Expense.spent_at >= m_start, Expense.spent_at <= m_end),
                                   Expense.branch_id, ids))
    debt = await db.scalar(_in(select(func.coalesce(func.sum(-Student.balance), 0)).where(Student.balance < 0),
                               Student.branch_id, ids))
    won_ids = select(LeadStatus.id).where(LeadStatus.is_won.is_(True))
    leads_month = await count(Lead, Lead.created_at >= t0, Lead.created_at <= t1, branch_col=Lead.branch_id)
    won_month = await count(Lead, Lead.created_at >= t0, Lead.created_at <= t1, Lead.status_id.in_(won_ids),
                            branch_col=Lead.branch_id)
    data = {
        "period": {"from": m_start, "to": m_end},
        "students_active": await count(Student, Student.status == StudentStatus.ACTIVE, branch_col=Student.branch_id),
        "groups_active": await count(Group, Group.status == GroupStatus.ACTIVE, branch_col=Group.branch_id),
        "leads_this_month": leads_month,
        "leads_won_this_month": won_month,
        "lead_conversion_percent": round(won_month * 100 / leads_month, 1) if leads_month else 0,
        "income_this_month": income or ZERO,
        "expenses_this_month": expenses or ZERO,
        "profit_this_month": (income or ZERO) - (expenses or ZERO),
        "debtors_count": await count(Student, Student.balance < 0, branch_col=Student.branch_id),
        "debt_total": debt or ZERO,
        "sessions_today": await db.scalar(_in(
            select(func.count(LessonSession.id)).join(Group, Group.id == LessonSession.group_id)
            .where(LessonSession.date == today(), LessonSession.status != SessionStatus.CANCELLED),
            Group.branch_id, ids)) or 0,
    }
    await cache_set(cache_key, data, ttl=60)
    return data


@router.get("/debtors")
async def debtors(db: MyDb, user: FinanceUser, branch_id: int | None = None, limit: int = 100):
    ids = branch_ids_for(user, branch_id)
    stmt = _in(select(Student).where(Student.balance < 0), Student.branch_id, ids).order_by(Student.balance).limit(
        min(limit, 500))
    return [{"student_id": s.id, "name": f"{s.first_name} {s.last_name}", "phone": s.phone,
             "parent_phone": s.parent_phone, "debt": -s.balance, "branch_id": s.branch_id}
            for s in (await db.execute(stmt)).scalars().all()]


@router.get("/lead-funnel")
async def lead_funnel(db: MyDb, user: FinanceUser, branch_id: int | None = None,
                      date_from: dt.date | None = None, date_to: dt.date | None = None):
    ids = branch_ids_for(user, branch_id)
    start, end = _range(date_from, date_to)
    q = (select(LeadStatus.id, LeadStatus.name, LeadStatus.is_won, LeadStatus.is_lost, func.count(Lead.id))
         .outerjoin(Lead, (Lead.status_id == LeadStatus.id) &
                    (Lead.created_at >= dt.datetime.combine(start, dt.time.min)) &
                    (Lead.created_at <= dt.datetime.combine(end, dt.time.max)))
         .group_by(LeadStatus.id, LeadStatus.name, LeadStatus.is_won, LeadStatus.is_lost, LeadStatus.position)
         .order_by(LeadStatus.position))
    if ids is not None:
        q = q.where((Lead.id.is_(None)) | (Lead.branch_id.in_(ids)))
    return {"period": {"from": start, "to": end},
            "stages": [{"status_id": i, "name": n, "is_won": w, "is_lost": l, "count": c}
                       for i, n, w, l, c in (await db.execute(q)).all()]}


@router.get("/lead-sources")
async def lead_sources(db: MyDb, user: FinanceUser, branch_id: int | None = None,
                       date_from: dt.date | None = None, date_to: dt.date | None = None):
    """Manba samaradorligi: lidlar, yutilganlar va bitta lid narxi (monthly_budget / lidlar)."""
    ids = branch_ids_for(user, branch_id)
    start, end = _range(date_from, date_to)
    won = select(LeadStatus.id).where(LeadStatus.is_won.is_(True))
    out = []
    for src in (await db.execute(select(LeadSource).order_by(LeadSource.name))).scalars().all():
        base = [Lead.source_id == src.id, Lead.created_at >= dt.datetime.combine(start, dt.time.min),
                Lead.created_at <= dt.datetime.combine(end, dt.time.max)]
        total = await db.scalar(_in(select(func.count(Lead.id)).where(*base), Lead.branch_id, ids)) or 0
        wins = await db.scalar(_in(select(func.count(Lead.id)).where(*base, Lead.status_id.in_(won)),
                                   Lead.branch_id, ids)) or 0
        out.append({"source_id": src.id, "name": src.name, "leads": total, "won": wins,
                    "monthly_budget": src.monthly_budget,
                    "cost_per_lead": round(src.monthly_budget / total, 2) if total else None,
                    "cost_per_student": round(src.monthly_budget / wins, 2) if wins else None})
    return {"period": {"from": start, "to": end}, "sources": out}


@router.get("/income-expense")
async def income_expense(db: MyDb, user: FinanceUser, branch_id: int | None = None,
                         date_from: dt.date | None = None, date_to: dt.date | None = None):
    ids = branch_ids_for(user, branch_id)
    start, end = _range(date_from, date_to)
    t0, t1 = dt.datetime.combine(start, dt.time.min), dt.datetime.combine(end, dt.time.max)
    income = await db.scalar(_in(
        select(func.coalesce(func.sum(Payment.amount), 0)).join(Student, Student.id == Payment.student_id)
        .where(Payment.status == PaymentStatus.COMPLETED, Payment.is_refunded.is_(False),
               Payment.paid_at >= t0, Payment.paid_at <= t1), Student.branch_id, ids)) or ZERO
    rows = (await db.execute(_in(
        select(ExpenseCategory.name, func.coalesce(func.sum(Expense.amount), 0))
        .join(Expense, Expense.category_id == ExpenseCategory.id)
        .where(Expense.spent_at >= start, Expense.spent_at <= end), Expense.branch_id, ids)
        .group_by(ExpenseCategory.name))).all()
    total_exp = sum((r[1] for r in rows), ZERO)
    return {"period": {"from": start, "to": end}, "income": income, "expenses": total_exp,
            "profit": income - total_exp, "expenses_by_category": [{"category": n, "total": t} for n, t in rows]}


@router.get("/export/debtors-excel", summary="Qarzdorlar ro'yxatini Excel (.xlsx) formatida yuklash")
async def export_debtors_excel(db: MyDb, user: FinanceUser, branch_id: int | None = None):
    """Barcha qarzdor o'quvchilarni formatlangan Excel jadval sifatida yuklaydi."""
    ids = branch_ids_for(user, branch_id)
    stmt = _in(select(Student).where(Student.balance < 0), Student.branch_id, ids).order_by(Student.balance)
    students = (await db.execute(stmt)).scalars().all()
    debtors = [
        {"name": f"{s.first_name} {s.last_name}", "phone": s.phone,
         "parent_phone": s.parent_phone, "debt": -s.balance}
        for s in students
    ]
    excel_bytes = export_debtors_to_excel(debtors, center_name=settings.CENTER_NAME)
    filename = f"qarzdorlar_{dt.date.today().isoformat()}.xlsx"
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
