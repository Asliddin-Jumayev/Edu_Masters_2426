from fastapi import APIRouter, HTTPException
from sqlalchemy import select
from app.models.communication import Notification, SmsLog, SmsTemplate
from app.models.crm import Lead
from app.models.enums import SmsStatus
from app.models.students import Student
from app.schemes.common import Message
from app.schemes.communication import (DebtReminder, NotificationResponse, SmsResponse, SmsSend, SmsTemplateIn,
                                       SmsTemplateResponse)
from app.services.messaging import deliver_sms, render, resend_sms
from app.utils.access import branch_ids_for, ensure_branch, scoped
from app.utils.checked import check_ident, ensure_unique, safe_commit
from app.utils.deps import MyDb
from app.utils.pagination import Page, Pagination, paginate
from app.utils.permissions import AuthUser, FinanceUser, ManagerUser
from app.utils.time import utcnow

templates_router = APIRouter(prefix="/sms-templates", tags=["Communication"])
sms_router = APIRouter(prefix="/sms", tags=["Communication"])
notif_router = APIRouter(prefix="/notifications", tags=["Communication"])


@templates_router.get("/", response_model=list[SmsTemplateResponse])
async def list_templates(db: MyDb, user: FinanceUser):
    return (await db.execute(select(SmsTemplate).order_by(SmsTemplate.code))).scalars().all()


@templates_router.post("/", response_model=SmsTemplateResponse, status_code=201)
async def create_template(data: SmsTemplateIn, db: MyDb, user: ManagerUser):
    await ensure_unique(db, SmsTemplate.code, data.code, msg="Bu kodli shablon mavjud")
    obj = SmsTemplate(**data.model_dump())
    db.add(obj)
    await safe_commit(db)
    return obj


@templates_router.put("/{template_id}", response_model=SmsTemplateResponse)
async def update_template(template_id: int, data: SmsTemplateIn, db: MyDb, user: ManagerUser):
    obj = await check_ident(db, SmsTemplate, template_id, "Shablon topilmadi")
    await ensure_unique(db, SmsTemplate.code, data.code, exclude_id=obj.id, msg="Bu kodli shablon mavjud")
    for k, v in data.model_dump().items():
        setattr(obj, k, v)
    await safe_commit(db)
    return obj


async def _template(db, code: str) -> SmsTemplate:
    t = await db.scalar(select(SmsTemplate).where(SmsTemplate.code == code, SmsTemplate.is_active.is_(True)))
    if t is None:
        raise HTTPException(404, f"Faol shablon topilmadi: {code}")
    return t


@sms_router.post("/send", response_model=SmsResponse, status_code=201)
async def send_sms(data: SmsSend, db: MyDb, user: FinanceUser):
    tpl = await _template(db, data.template_code) if data.template_code else None
    ctx = dict(data.params)
    if data.student_id is not None:
        s = await check_ident(db, Student, data.student_id, "O'quvchi topilmadi")
        ensure_branch(user, s.branch_id)
        phone = {"student": s.phone, "parent": s.parent_phone}.get(data.to) or s.parent_phone or s.phone
        ctx.setdefault("name", s.first_name)
        ctx.setdefault("debt", str(max(-s.balance, 0)))
        sid, lid = s.id, None
    else:
        lead = await check_ident(db, Lead, data.lead_id, "Lid topilmadi")
        ensure_branch(user, lead.branch_id)
        phone = lead.phone
        ctx.setdefault("name", lead.first_name)
        sid, lid = None, lead.id
    if not phone:
        raise HTTPException(400, "Qabul qiluvchining telefon raqami yo'q")
    body = render(tpl.body if tpl else data.body, ctx)
    log = await deliver_sms(db, phone=phone, body=body, template_id=tpl.id if tpl else None, student_id=sid, lead_id=lid)
    await safe_commit(db)
    return log


@sms_router.post("/debt-reminders", response_model=Message)
async def debt_reminders(data: DebtReminder, db: MyDb, user: FinanceUser):
    """Qarzdor o'quvchilarga 'payment_reminder' shabloni bilan ommaviy SMS (bir martada 500 tagacha)."""
    tpl = await _template(db, "payment_reminder")
    ids = branch_ids_for(user, data.branch_id)
    stmt = select(Student).where(Student.balance < -data.min_debt).limit(500)
    if ids is not None:
        stmt = stmt.where(Student.branch_id.in_(ids))
    sent = skipped = 0
    for s in (await db.execute(stmt)).scalars().all():
        phone = s.parent_phone or s.phone
        if not phone:
            skipped += 1
            continue
        body = render(tpl.body, {"name": s.first_name, "debt": str(-s.balance)})
        await deliver_sms(db, phone=phone, body=body, template_id=tpl.id, student_id=s.id)
        sent += 1
    await safe_commit(db)
    return Message(msg=f"{sent} ta SMS yuborildi, {skipped} ta o'tkazib yuborildi (raqam yo'q)")


@sms_router.post("/{sms_id}/retry", response_model=SmsResponse)
async def retry_sms(sms_id: int, db: MyDb, user: FinanceUser):
    """Yuborilmagan (failed) SMS ni qayta yuboradi."""
    row = await check_ident(db, SmsLog, sms_id, "SMS topilmadi")
    if row.status != SmsStatus.FAILED:
        raise HTTPException(409, "Faqat xato bilan tugagan SMS ni qayta yuborish mumkin")
    if row.student_id:
        ensure_branch(user, (await check_ident(db, Student, row.student_id)).branch_id)
    elif row.lead_id:
        ensure_branch(user, (await check_ident(db, Lead, row.lead_id)).branch_id)
    await resend_sms(row)
    await safe_commit(db)
    return row


@sms_router.get("/logs", response_model=Page[SmsResponse])
async def sms_logs(db: MyDb, user: FinanceUser, params: Pagination, student_id: int | None = None,
                   lead_id: int | None = None):
    stmt = select(SmsLog).order_by(SmsLog.id.desc())
    ids = branch_ids_for(user, None)
    if ids is not None:
        stmt = stmt.outerjoin(Student, Student.id == SmsLog.student_id).outerjoin(Lead, Lead.id == SmsLog.lead_id)
        stmt = stmt.where((Student.branch_id.in_(ids)) | (Lead.branch_id.in_(ids)))
    if student_id is not None:
        stmt = stmt.where(SmsLog.student_id == student_id)
    if lead_id is not None:
        stmt = stmt.where(SmsLog.lead_id == lead_id)
    return await paginate(db, stmt, params)


# ---------------- bildirishnomalar (faqat o'zinikini ko'radi) ----------------
@notif_router.get("/", response_model=Page[NotificationResponse])
async def my_notifications(db: MyDb, user: AuthUser, params: Pagination, unread_only: bool = False):
    stmt = select(Notification).where(Notification.employee_id == user.id).order_by(Notification.id.desc())
    if unread_only:
        stmt = stmt.where(Notification.is_read.is_(False))
    return await paginate(db, stmt, params)


@notif_router.get("/unread-count")
async def unread_count(db: MyDb, user: AuthUser):
    from sqlalchemy import func
    n = await db.scalar(select(func.count(Notification.id)).where(Notification.employee_id == user.id,
                                                                  Notification.is_read.is_(False)))
    return {"unread": n or 0}


@notif_router.patch("/{notif_id}/read", response_model=NotificationResponse)
async def mark_read(notif_id: int, db: MyDb, user: AuthUser):
    n = await check_ident(db, Notification, notif_id, "Bildirishnoma topilmadi")
    if n.employee_id != user.id:
        raise HTTPException(404, "Bildirishnoma topilmadi")
    n.is_read = True
    await safe_commit(db)
    return n


@notif_router.post("/read-all", response_model=Message)
async def read_all(db: MyDb, user: AuthUser):
    from sqlalchemy import update
    await db.execute(update(Notification).where(Notification.employee_id == user.id,
                                                Notification.is_read.is_(False)).values(is_read=True))
    await safe_commit(db)
    return Message(msg="Hammasi o'qilgan deb belgilandi")
