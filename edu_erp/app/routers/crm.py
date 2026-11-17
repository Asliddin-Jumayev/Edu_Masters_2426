import datetime as dt
from fastapi import APIRouter, HTTPException, Query, Request
from sqlalchemy import or_, select
from app.models.branches import Branch
from app.models.courses import Course
from app.models.crm import Lead, LeadActivity, LeadSource, LeadStatus, Task, TrialLesson
from app.models.employees import Employee
from app.models.groups import Group
from app.models.students import Student
from app.schemes.common import Message
from app.schemes.crm import (ActivityCreate, ActivityResponse, LeadConvert, LeadCreate, LeadResponse, LeadSourceIn,
                             LeadSourceResponse, LeadStatusChange, LeadStatusIn, LeadStatusResponse, LeadUpdate,
                             PublicLeadIn, TaskCreate, TaskResponse, TaskUpdate, TrialCreate, TrialResponse, TrialResult)
from app.schemes.students import StudentResponse
from app.services.enrollment import enroll_student
from app.services.messaging import notify
from app.utils.access import ensure_branch, has_role, is_teacher_only, scoped
from app.utils.audit import add_audit
from app.utils.checked import check_ident, safe_commit
from app.utils.deps import MyDb
from app.utils.pagination import Page, Pagination, paginate
from app.utils.permissions import AuthUser, ManagerUser
from app.utils.rate_limit import limiter
from app.utils.roles import ADMIN, MANAGER
from app.utils.time import utcnow

# ---------------- manbalar ----------------
sources_router = APIRouter(prefix="/lead-sources", tags=["CRM"])


@sources_router.get("/", response_model=list[LeadSourceResponse])
async def list_sources(db: MyDb, user: ManagerUser, is_active: bool | None = None):
    stmt = select(LeadSource).order_by(LeadSource.name)
    if is_active is not None:
        stmt = stmt.where(LeadSource.is_active == is_active)
    return (await db.execute(stmt)).scalars().all()


@sources_router.post("/", response_model=LeadSourceResponse, status_code=201)
async def create_source(data: LeadSourceIn, db: MyDb, user: ManagerUser):
    obj = LeadSource(**data.model_dump())
    db.add(obj)
    await safe_commit(db)
    return obj


@sources_router.put("/{source_id}", response_model=LeadSourceResponse)
async def update_source(source_id: int, data: LeadSourceIn, db: MyDb, user: ManagerUser):
    obj = await check_ident(db, LeadSource, source_id, "Manba topilmadi")
    for k, v in data.model_dump().items():
        setattr(obj, k, v)
    await safe_commit(db)
    return obj


@sources_router.delete("/{source_id}", response_model=Message)
async def deactivate_source(source_id: int, db: MyDb, user: ManagerUser):
    obj = await check_ident(db, LeadSource, source_id, "Manba topilmadi")
    obj.is_active = False
    await safe_commit(db)
    return Message(msg="Manba faolsizlantirildi")


# ---------------- bosqichlar ----------------
statuses_router = APIRouter(prefix="/lead-statuses", tags=["CRM"])


@statuses_router.get("/", response_model=list[LeadStatusResponse])
async def list_statuses(db: MyDb, user: ManagerUser):
    return (await db.execute(select(LeadStatus).order_by(LeadStatus.position, LeadStatus.id))).scalars().all()


@statuses_router.post("/", response_model=LeadStatusResponse, status_code=201)
async def create_status(data: LeadStatusIn, db: MyDb, user: ManagerUser):
    obj = LeadStatus(**data.model_dump())
    db.add(obj)
    await safe_commit(db)
    return obj


@statuses_router.put("/{status_id}", response_model=LeadStatusResponse)
async def update_status(status_id: int, data: LeadStatusIn, db: MyDb, user: ManagerUser):
    obj = await check_ident(db, LeadStatus, status_id, "Bosqich topilmadi")
    for k, v in data.model_dump().items():
        setattr(obj, k, v)
    await safe_commit(db)
    return obj


@statuses_router.delete("/{status_id}", response_model=Message)
async def delete_status(status_id: int, db: MyDb, user: ManagerUser):
    obj = await check_ident(db, LeadStatus, status_id, "Bosqich topilmadi")
    if await db.scalar(select(Lead.id).where(Lead.status_id == obj.id).limit(1)):
        raise HTTPException(409, "Bu bosqichda lidlar bor")
    await db.delete(obj)
    await safe_commit(db)
    return Message(msg="Bosqich o'chirildi")


# ---------------- lidlar ----------------
router = APIRouter(prefix="/leads", tags=["CRM"])


async def _load(db, user, lead_id: int) -> Lead:
    lead = await check_ident(db, Lead, lead_id, "Lid topilmadi")
    ensure_branch(user, lead.branch_id)
    return lead


async def _check_assignee(db, emp_id: int):
    emp = await db.get(Employee, emp_id)
    if emp is None or not emp.is_active:
        raise HTTPException(400, "Mas'ul xodim topilmadi yoki faol emas")


@router.post("/public", response_model=Message, status_code=201, summary="Bosh sahifadan ariza (lid) qoldirish")
@limiter.limit("5/minute")
async def create_public_lead(request: Request, data: PublicLeadIn, db: MyDb):
    """Bosh sahifadan tashrif buyuruvchilar kursga yozilish yoki konsultatsiya so'rab qoldirgan ariza."""
    branch_id = data.branch_id
    if branch_id is None:
        branch_id = await db.scalar(select(Branch.id).where(Branch.is_active == True).order_by(Branch.id).limit(1)) or 1
    else:
        await check_ident(db, Branch, branch_id, "Filial topilmadi")

    if data.course_id:
        await check_ident(db, Course, data.course_id, "Kurs topilmadi")

    # Manba: 'Veb-sayt' yoki birinchi faol manba
    site_source = await db.scalar(select(LeadSource.id).where(LeadSource.name.ilike("%sayt%") | LeadSource.name.ilike("%web%")).limit(1))
    if site_source is None:
        site_source = await db.scalar(select(LeadSource.id).where(LeadSource.is_active == True).limit(1))

    # Boshlang'ich status
    status_id = await db.scalar(select(LeadStatus.id).where(LeadStatus.is_won.is_(False), LeadStatus.is_lost.is_(False))
                                .order_by(LeadStatus.position, LeadStatus.id).limit(1))
    if status_id is None:
        raise HTTPException(400, "Lid bosqichlari sozlanmagan")

    # Qayta ariza bo'lsa yangilaymiz
    dup = await db.scalar(select(Lead).where(Lead.phone == data.phone, Lead.status_id == status_id))
    if dup:
        if data.comment:
            dup.comment = f"{(dup.comment or '')} | Qayta: {data.comment}"[:500]
            await safe_commit(db)
        return Message(msg="Arizangiz qabul qilindi. Tez orada menejerlarimiz siz bilan bog'lanishadi!")

    obj = Lead(
        branch_id=branch_id,
        first_name=data.first_name,
        phone=data.phone,
        source_id=site_source,
        course_id=data.course_id,
        status_id=status_id,
        comment=data.comment or "Veb-saytdan ariza",
        created_by=None,
    )
    db.add(obj)
    await safe_commit(db)
    return Message(msg="Arizangiz muvaffaqiyatli qabul qilindi. Tez orada menejerlarimiz siz bilan bog'lanishadi!")


@router.post("/", response_model=LeadResponse, status_code=201)
async def create_lead(data: LeadCreate, db: MyDb, user: ManagerUser):
    ensure_branch(user, data.branch_id)
    await check_ident(db, Branch, data.branch_id, "Filial topilmadi")
    if data.source_id:
        await check_ident(db, LeadSource, data.source_id, "Manba topilmadi")
    if data.course_id:
        await check_ident(db, Course, data.course_id, "Kurs topilmadi")
    if data.assigned_to:
        await _check_assignee(db, data.assigned_to)
    status_id = data.status_id
    if status_id is None:
        first = await db.scalar(select(LeadStatus).where(LeadStatus.is_won.is_(False), LeadStatus.is_lost.is_(False))
                                .order_by(LeadStatus.position, LeadStatus.id).limit(1))
        if first is None:
            raise HTTPException(400, "Lid bosqichlari sozlanmagan (lead_statuses)")
        status_id = first.id
    else:
        st = await check_ident(db, LeadStatus, status_id, "Bosqich topilmadi")
        if st.is_won:
            raise HTTPException(400, "Yutilgan bosqichga faqat konvertatsiya orqali o'tiladi")
    dup = await db.scalar(select(Lead.id).where(Lead.branch_id == data.branch_id, Lead.phone == data.phone))
    if dup:
        raise HTTPException(409, f"Bu telefon raqamli lid allaqachon mavjud (#{dup})")
    payload = data.model_dump(exclude={"status_id"})
    obj = Lead(**payload, status_id=status_id, created_by=user.id)
    db.add(obj)
    await db.flush()
    if obj.assigned_to and obj.assigned_to != user.id:
        notify(db, obj.assigned_to, "lead_assigned", "Yangi lid biriktirildi", f"{obj.first_name} ({obj.phone})")
    await safe_commit(db)
    return obj


@router.get("/", response_model=Page[LeadResponse])
async def list_leads(db: MyDb, user: ManagerUser, params: Pagination, branch_id: int | None = None,
                     status_id: int | None = None, source_id: int | None = None, assigned_to: int | None = None,
                     q: str | None = None, open_only: bool = False,
                     date_from: dt.date | None = None, date_to: dt.date | None = None):
    stmt = scoped(select(Lead), Lead.branch_id, user).order_by(Lead.id.desc())
    if branch_id is not None:
        stmt = stmt.where(Lead.branch_id == branch_id)
    if status_id is not None:
        stmt = stmt.where(Lead.status_id == status_id)
    if source_id is not None:
        stmt = stmt.where(Lead.source_id == source_id)
    if assigned_to is not None:
        stmt = stmt.where(Lead.assigned_to == assigned_to)
    if open_only:
        stmt = stmt.where(Lead.status_id.in_(select(LeadStatus.id).where(LeadStatus.is_won.is_(False),
                                                                          LeadStatus.is_lost.is_(False))))
    if date_from:
        stmt = stmt.where(Lead.created_at >= dt.datetime.combine(date_from, dt.time.min))
    if date_to:
        stmt = stmt.where(Lead.created_at <= dt.datetime.combine(date_to, dt.time.max))
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(Lead.first_name.ilike(like), Lead.last_name.ilike(like), Lead.phone.ilike(like)))
    return await paginate(db, stmt, params)


@router.get("/{lead_id}", response_model=LeadResponse)
async def get_lead(lead_id: int, db: MyDb, user: ManagerUser):
    return await _load(db, user, lead_id)


@router.put("/{lead_id}", response_model=LeadResponse)
async def update_lead(lead_id: int, data: LeadUpdate, db: MyDb, user: ManagerUser):
    lead = await _load(db, user, lead_id)
    ch = data.model_dump(exclude_unset=True)
    if "phone" in ch and ch["phone"] != lead.phone:
        if await db.scalar(select(Lead.id).where(Lead.branch_id == lead.branch_id, Lead.phone == ch["phone"],
                                                 Lead.id != lead.id)):
            raise HTTPException(409, "Bu telefon raqamli lid allaqachon mavjud")
    if ch.get("source_id"):
        await check_ident(db, LeadSource, ch["source_id"], "Manba topilmadi")
    if ch.get("course_id"):
        await check_ident(db, Course, ch["course_id"], "Kurs topilmadi")
    if ch.get("assigned_to") and ch["assigned_to"] != lead.assigned_to:
        await _check_assignee(db, ch["assigned_to"])
        if ch["assigned_to"] != user.id:
            notify(db, ch["assigned_to"], "lead_assigned", "Lid sizga biriktirildi", f"{lead.first_name} ({lead.phone})")
    for k, v in ch.items():
        setattr(lead, k, v)
    await safe_commit(db)
    return lead


@router.patch("/{lead_id}/status", response_model=LeadResponse)
async def change_status(lead_id: int, data: LeadStatusChange, db: MyDb, user: ManagerUser):
    lead = await _load(db, user, lead_id)
    if lead.student_id:
        raise HTTPException(409, "Lid allaqachon o'quvchiga aylantirilgan")
    st = await check_ident(db, LeadStatus, data.status_id, "Bosqich topilmadi")
    if st.is_won:
        raise HTTPException(400, "Yutilgan bosqichga faqat /convert orqali o'tiladi")
    if st.is_lost:
        if not data.lost_reason:
            raise HTTPException(400, "Yo'qotilgan lid uchun lost_reason majburiy")
        lead.lost_reason = data.lost_reason
    else:
        lead.lost_reason = None
    lead.status_id = st.id
    await safe_commit(db)
    return lead


class _ConvertOut(StudentResponse):
    lead_id: int | None = None
    enrollment_id: int | None = None


@router.post("/{lead_id}/convert", response_model=_ConvertOut, status_code=201)
async def convert(lead_id: int, data: LeadConvert, db: MyDb, user: ManagerUser):
    """Lidni o'quvchiga aylantiradi; ixtiyoriy ravishda darhol guruhga yozadi."""
    lead = await _load(db, user, lead_id)
    if lead.student_id:
        raise HTTPException(409, "Lid allaqachon o'quvchiga aylantirilgan")
    last_name = data.last_name or lead.last_name
    if not last_name:
        raise HTTPException(400, "Familiya kerak: last_name yuboring")
    won = await db.scalar(select(LeadStatus).where(LeadStatus.is_won.is_(True)).order_by(LeadStatus.position).limit(1))
    if won is None:
        raise HTTPException(400, "'Yutilgan' (is_won) bosqich sozlanmagan")
    student = Student(branch_id=lead.branch_id, first_name=lead.first_name, last_name=last_name, phone=lead.phone,
                      parent_phone=data.parent_phone, birth_date=data.birth_date, source_id=lead.source_id)
    db.add(student)
    await db.flush()
    enr_id = None
    group_id = data.group_id
    if group_id:
        enr = await enroll_student(db, student, group_id, data.price)
        enr_id = enr.id
    lead.student_id = student.id
    lead.status_id = won.id
    lead.lost_reason = None
    add_audit(db, user, "convert", "lead", lead.id, new={"student_id": student.id})
    await safe_commit(db)
    out = _ConvertOut.model_validate(student)
    out.lead_id, out.enrollment_id = lead.id, enr_id
    return out


# ---------------- faoliyat ----------------
@router.get("/{lead_id}/activities", response_model=list[ActivityResponse])
async def list_activities(lead_id: int, db: MyDb, user: ManagerUser):
    await _load(db, user, lead_id)
    return (await db.execute(select(LeadActivity).where(LeadActivity.lead_id == lead_id)
                             .order_by(LeadActivity.id.desc()))).scalars().all()


@router.post("/{lead_id}/activities", response_model=ActivityResponse, status_code=201)
async def add_activity(lead_id: int, data: ActivityCreate, db: MyDb, user: ManagerUser):
    await _load(db, user, lead_id)
    obj = LeadActivity(lead_id=lead_id, employee_id=user.id, **data.model_dump())
    db.add(obj)
    await safe_commit(db)
    return obj


# ---------------- vazifalar ----------------
tasks_router = APIRouter(prefix="/tasks", tags=["CRM"])


def _is_mgr(user) -> bool:
    return has_role(user, ADMIN, MANAGER)


async def _load_task(db, user, task_id: int) -> Task:
    t = await check_ident(db, Task, task_id, "Vazifa topilmadi")
    if not _is_mgr(user) and user.id not in (t.assigned_to, t.created_by):
        raise HTTPException(403, "Bu vazifa sizniki emas")
    return t


@tasks_router.post("/", response_model=TaskResponse, status_code=201)
async def create_task(data: TaskCreate, db: MyDb, user: AuthUser):
    assignee = data.assigned_to or user.id
    if assignee != user.id:
        if not _is_mgr(user):
            raise HTTPException(403, "Vazifani boshqaga faqat manager biriktira oladi")
        await _check_assignee(db, assignee)
    if data.lead_id:
        await _load(db, user, data.lead_id) if _is_mgr(user) else await check_ident(db, Lead, data.lead_id, "Lid topilmadi")
    if data.student_id:
        await check_ident(db, Student, data.student_id, "O'quvchi topilmadi")
    obj = Task(**data.model_dump(exclude={"assigned_to"}), assigned_to=assignee, created_by=user.id)
    db.add(obj)
    await db.flush()
    if assignee != user.id:
        notify(db, assignee, "task_assigned", "Yangi vazifa", obj.title)
    await safe_commit(db)
    return obj


@tasks_router.get("/", response_model=Page[TaskResponse])
async def list_tasks(db: MyDb, user: AuthUser, params: Pagination, assigned_to: int | None = None,
                     completed: bool | None = None, overdue: bool = False, lead_id: int | None = None,
                     student_id: int | None = None):
    stmt = select(Task).order_by(Task.due_at.is_(None), Task.due_at, Task.id.desc())
    if _is_mgr(user):
        if assigned_to is not None:
            stmt = stmt.where(Task.assigned_to == assigned_to)
    else:
        stmt = stmt.where(Task.assigned_to == user.id)
    if completed is True:
        stmt = stmt.where(Task.completed_at.is_not(None))
    elif completed is False:
        stmt = stmt.where(Task.completed_at.is_(None))
    if overdue:
        stmt = stmt.where(Task.completed_at.is_(None), Task.due_at < utcnow())
    if lead_id is not None:
        stmt = stmt.where(Task.lead_id == lead_id)
    if student_id is not None:
        stmt = stmt.where(Task.student_id == student_id)
    return await paginate(db, stmt, params)


@tasks_router.put("/{task_id}", response_model=TaskResponse)
async def update_task(task_id: int, data: TaskUpdate, db: MyDb, user: AuthUser):
    t = await _load_task(db, user, task_id)
    ch = data.model_dump(exclude_unset=True)
    if ch.get("assigned_to") and ch["assigned_to"] != t.assigned_to:
        if not _is_mgr(user):
            raise HTTPException(403, "Vazifani boshqaga faqat manager biriktira oladi")
        await _check_assignee(db, ch["assigned_to"])
        notify(db, ch["assigned_to"], "task_assigned", "Yangi vazifa", t.title)
    for k, v in ch.items():
        setattr(t, k, v)
    await safe_commit(db)
    return t


@tasks_router.patch("/{task_id}/complete", response_model=TaskResponse)
async def complete_task(task_id: int, db: MyDb, user: AuthUser, done: bool = True):
    t = await _load_task(db, user, task_id)
    t.completed_at = utcnow() if done else None
    await safe_commit(db)
    return t


@tasks_router.delete("/{task_id}", response_model=Message)
async def delete_task(task_id: int, db: MyDb, user: AuthUser):
    t = await _load_task(db, user, task_id)
    await db.delete(t)
    await safe_commit(db)
    return Message(msg="Vazifa o'chirildi")


# ---------------- sinov darslari ----------------
trials_router = APIRouter(prefix="/trial-lessons", tags=["CRM"])


@trials_router.post("/", response_model=TrialResponse, status_code=201)
async def create_trial(data: TrialCreate, db: MyDb, user: ManagerUser):
    lead = await _load(db, user, data.lead_id)
    group = await check_ident(db, Group, data.group_id, "Guruh topilmadi")
    if group.branch_id != lead.branch_id:
        raise HTTPException(400, "Lid va guruh filiali bir xil bo'lishi kerak")
    obj = TrialLesson(**data.model_dump())
    db.add(obj)
    await safe_commit(db)
    return obj


@trials_router.get("/", response_model=list[TrialResponse])
async def list_trials(db: MyDb, user: AuthUser, lead_id: int | None = None, group_id: int | None = None,
                      date_from: dt.date | None = None, date_to: dt.date | None = None):
    stmt = scoped(select(TrialLesson).join(Group, Group.id == TrialLesson.group_id), Group.branch_id, user)
    stmt = stmt.order_by(TrialLesson.scheduled_at)
    if is_teacher_only(user):
        stmt = stmt.where(Group.teacher_id == user.id)
    if lead_id is not None:
        stmt = stmt.where(TrialLesson.lead_id == lead_id)
    if group_id is not None:
        stmt = stmt.where(TrialLesson.group_id == group_id)
    if date_from:
        stmt = stmt.where(TrialLesson.scheduled_at >= dt.datetime.combine(date_from, dt.time.min))
    if date_to:
        stmt = stmt.where(TrialLesson.scheduled_at <= dt.datetime.combine(date_to, dt.time.max))
    return (await db.execute(stmt)).scalars().all()


@trials_router.patch("/{trial_id}/result", response_model=TrialResponse)
async def trial_result(trial_id: int, data: TrialResult, db: MyDb, user: AuthUser):
    t = await check_ident(db, TrialLesson, trial_id, "Sinov darsi topilmadi")
    g = await db.get(Group, t.group_id)
    ensure_branch(user, g.branch_id)
    if not _is_mgr(user) and g.teacher_id != user.id:
        raise HTTPException(403, "Natijani faqat manager yoki guruh o'qituvchisi kiritadi")
    t.attended, t.feedback = data.attended, data.feedback
    await safe_commit(db)
    return t
