import datetime as dt
from decimal import Decimal
from sqlalchemy import func, or_, select
from app.models.enums import InvoiceStatus, SalaryType, SessionStatus
from app.models.finance import Invoice
from app.models.groups import Group
from app.models.lessons import LessonSession
from app.models.payroll import SalaryRule
from app.models.students import Enrollment
from app.services.finance import q2
from app.utils.time import month_end, month_start


async def active_rule(db, employee_id: int, period_month: dt.date) -> SalaryRule | None:
    start, end = month_start(period_month), month_end(period_month)
    return (await db.execute(
        select(SalaryRule).where(SalaryRule.employee_id == employee_id, SalaryRule.effective_from <= end,
                                 or_(SalaryRule.effective_to.is_(None), SalaryRule.effective_to >= start))
        .order_by(SalaryRule.effective_from.desc(), SalaryRule.id.desc()).limit(1))).scalar_one_or_none()


async def calculate(db, employee_id: int, period_month: dt.date) -> tuple[int, Decimal]:
    """(o'tilgan darslar soni, asosiy summa). Faqat 'held' darslar hisobga olinadi."""
    start, end = month_start(period_month), month_end(period_month)
    sessions = (await db.execute(select(LessonSession).where(
        LessonSession.teacher_id == employee_id, LessonSession.status == SessionStatus.HELD,
        LessonSession.date >= start, LessonSession.date <= end))).scalars().all()
    lessons = len(sessions)
    rule = await active_rule(db, employee_id, period_month)
    if rule is None:
        return lessons, Decimal("0")
    if rule.type == SalaryType.FIXED:
        base = rule.amount
    elif rule.type == SalaryType.PER_LESSON:
        base = rule.amount * lessons
    elif rule.type == SalaryType.HOURLY:
        hours = sum(((dt.datetime.combine(s.date, s.end_time) - dt.datetime.combine(s.date, s.start_time))
                     .total_seconds() / 3600 for s in sessions), 0.0)
        base = rule.amount * Decimal(str(round(hours, 2)))
    else:  # PERCENT: o'qituvchi guruhlari shu oy uchun TO'LANGAN tushumidan
        revenue = await db.scalar(
            select(func.coalesce(func.sum(Invoice.paid_amount), 0))
            .join(Enrollment, Invoice.enrollment_id == Enrollment.id)
            .join(Group, Enrollment.group_id == Group.id)
            .where(Group.teacher_id == employee_id, Invoice.period_month == start,
                   Invoice.status != InvoiceStatus.CANCELLED))
        base = Decimal(revenue) * (rule.percent or 0) / 100
    return lessons, q2(base)
