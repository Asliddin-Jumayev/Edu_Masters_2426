import datetime as dt
from decimal import Decimal
import asyncio
from fastapi import APIRouter, HTTPException, Response
from sqlalchemy import func, select
from app.models.courses import Course
from app.models.branches import Branch
from app.models.enums import EnrollmentStatus, ExamType, GroupStatus
from app.models.exams import Certificate, Exam, ExamResult
from app.models.groups import Group
from app.models.students import Enrollment, Student
from app.schemes.common import Message
from app.schemes.exams import (CertificateIssue, CertificateResponse, CertificateVerify, ExamCreate, ExamResponse,
                               ExamUpdate, ResultResponse, ResultsBulk)
from app.utils.access import ensure_branch, has_role, is_admin, is_teacher_only, scoped
from app.models.employees import Employee
from app.services.certificate_pdf import build_certificate_pdf
from app.utils.config import settings
from app.utils.audit import add_audit
from app.utils.checked import check_ident, safe_commit
from app.utils.deps import MyDb
from app.utils.pagination import Page, Pagination, paginate
from app.utils.permissions import AcademicUser, AuthUser, ManagerUser
from app.utils.roles import ADMIN, MANAGER
from app.utils.time import today, utcnow

router = APIRouter(prefix="/exams", tags=["Exams"])


async def _group_for(db, user, group_id: int) -> Group:
    g = await check_ident(db, Group, group_id, "Guruh topilmadi")
    ensure_branch(user, g.branch_id)
    if is_teacher_only(user) and g.teacher_id != user.id:
        raise HTTPException(403, "Bu guruh sizga biriktirilmagan")
    return g


@router.post("/", response_model=ExamResponse, status_code=201)
async def create_exam(data: ExamCreate, db: MyDb, user: AcademicUser):
    await _group_for(db, user, data.group_id)
    obj = Exam(**data.model_dump(), created_by=user.id)
    db.add(obj)
    await safe_commit(db)
    return obj


@router.get("/", response_model=Page[ExamResponse])
async def list_exams(db: MyDb, user: AuthUser, params: Pagination, group_id: int | None = None,
                     type_: ExamType | None = None):
    stmt = scoped(select(Exam).join(Group, Group.id == Exam.group_id), Group.branch_id, user).order_by(Exam.id.desc())
    if is_teacher_only(user):
        stmt = stmt.where(Group.teacher_id == user.id)
    if group_id is not None:
        stmt = stmt.where(Exam.group_id == group_id)
    if type_ is not None:
        stmt = stmt.where(Exam.type == type_)
    return await paginate(db, stmt, params)


async def _exam(db, user, exam_id: int) -> tuple[Exam, Group]:
    e = await check_ident(db, Exam, exam_id, "Imtihon topilmadi")
    return e, await _group_for(db, user, e.group_id)


@router.get("/{exam_id}", response_model=ExamResponse)
async def get_exam(exam_id: int, db: MyDb, user: AuthUser):
    return (await _exam(db, user, exam_id))[0]


@router.put("/{exam_id}", response_model=ExamResponse)
async def update_exam(exam_id: int, data: ExamUpdate, db: MyDb, user: AcademicUser):
    e, _ = await _exam(db, user, exam_id)
    ch = data.model_dump(exclude_unset=True)
    mx, ps = ch.get("max_score", e.max_score), ch.get("passing_score", e.passing_score)
    if ps > mx:
        raise HTTPException(400, "passing_score max_score dan oshmasligi kerak")
    if "max_score" in ch and ch["max_score"] < e.max_score:
        over = await db.scalar(select(ExamResult.id).where(ExamResult.exam_id == e.id,
                                                          ExamResult.score > ch["max_score"]).limit(1))
        if over:
            raise HTTPException(409, "Mavjud natijalar yangi max_score dan katta")
    for k, v in ch.items():
        setattr(e, k, v)
    await safe_commit(db)
    return e


@router.delete("/{exam_id}", response_model=Message)
async def delete_exam(exam_id: int, db: MyDb, user: ManagerUser):
    e, _ = await _exam(db, user, exam_id)
    if await db.scalar(select(ExamResult.id).where(ExamResult.exam_id == e.id).limit(1)):
        raise HTTPException(409, "Imtihonda natijalar bor")
    await db.delete(e)
    await safe_commit(db)
    return Message(msg="Imtihon o'chirildi")


@router.put("/{exam_id}/results", response_model=list[ResultResponse])
async def save_results(exam_id: int, data: ResultsBulk, db: MyDb, user: AcademicUser):
    e, g = await _exam(db, user, exam_id)
    ids = [r.student_id for r in data.results]
    if len(set(ids)) != len(ids):
        raise HTTPException(400, "Bir o'quvchi ikki marta kiritilgan")
    enrolled = set((await db.execute(select(Enrollment.student_id).where(Enrollment.group_id == g.id)))
                   .scalars().all())
    bad = [i for i in ids if i not in enrolled]
    if bad:
        raise HTTPException(400, f"Guruhga yozilmagan o'quvchilar: {bad}")
    over = [r.student_id for r in data.results if r.score > e.max_score]
    if over:
        raise HTTPException(400, f"Ball max_score ({e.max_score}) dan oshib ketdi: {over}")
    existing = {r.student_id: r for r in (await db.execute(
        select(ExamResult).where(ExamResult.exam_id == e.id))).scalars().all()}
    for it in data.results:
        r = existing.get(it.student_id)
        if r is None:
            db.add(ExamResult(exam_id=e.id, student_id=it.student_id, score=it.score, graded_by=user.id,
                              graded_at=utcnow()))
        else:
            r.score, r.graded_by, r.graded_at = it.score, user.id, utcnow()
    await safe_commit(db)
    return await _results(db, e)


async def _results(db, e: Exam) -> list[ResultResponse]:
    rows = (await db.execute(select(ExamResult, Student.first_name, Student.last_name)
                             .join(Student, Student.id == ExamResult.student_id)
                             .where(ExamResult.exam_id == e.id).order_by(Student.last_name))).all()
    return [ResultResponse(id=r.id, exam_id=r.exam_id, student_id=r.student_id, score=r.score, graded_by=r.graded_by,
                           graded_at=r.graded_at, first_name=fn, last_name=ln, passed=r.score >= e.passing_score)
            for r, fn, ln in rows]


@router.get("/{exam_id}/results", response_model=list[ResultResponse])
async def get_results(exam_id: int, db: MyDb, user: AuthUser):
    e, _ = await _exam(db, user, exam_id)
    return await _results(db, e)


# ---------- sertifikatlar ----------
cert_router = APIRouter(prefix="/certificates", tags=["Certificates"])


@cert_router.get("/verify/{serial}", response_model=CertificateVerify)
async def verify(serial: str, db: MyDb):
    """Ochiq endpoint (auth yo'q): sertifikat haqiqiyligini tekshirish. Faqat minimal ma'lumot."""
    row = (await db.execute(
        select(Certificate, Student.first_name, Student.last_name, Course.name)
        .join(Student, Student.id == Certificate.student_id).join(Group, Group.id == Certificate.group_id)
        .join(Course, Course.id == Group.course_id).where(Certificate.serial_number == serial))).first()
    if row is None:
        return CertificateVerify(valid=False, serial_number=serial)
    c, fn, ln, cname = row
    return CertificateVerify(valid=True, serial_number=serial, student_name=f"{fn} {ln}", course_name=cname,
                             issued_at=c.issued_at)


@cert_router.post("/", response_model=CertificateResponse, status_code=201)
async def issue(data: CertificateIssue, db: MyDb, user: ManagerUser):
    student = await check_ident(db, Student, data.student_id, "O'quvchi topilmadi")
    group = await check_ident(db, Group, data.group_id, "Guruh topilmadi")
    ensure_branch(user, group.branch_id)
    if data.force and not is_admin(user):
        raise HTTPException(403, "force faqat admin uchun")
    if not data.force:
        enr = await db.scalar(select(Enrollment).where(
            Enrollment.student_id == student.id, Enrollment.group_id == group.id,
            Enrollment.status.in_([EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED])).limit(1))
        if enr is None:
            raise HTTPException(400, "O'quvchi bu guruhda o'qimagan yoki chiqib ketgan")
        if group.status != GroupStatus.COMPLETED and enr.status != EnrollmentStatus.COMPLETED:
            raise HTTPException(400, "Guruh yoki yozilish hali yakunlanmagan")
        finals = (await db.execute(select(Exam).where(Exam.group_id == group.id, Exam.type == ExamType.FINAL))).scalars().all()
        for ex in finals:
            sc = await db.scalar(select(ExamResult.score).where(ExamResult.exam_id == ex.id,
                                                                ExamResult.student_id == student.id))
            if sc is None or sc < ex.passing_score:
                raise HTTPException(400, f"Yakuniy imtihondan o'tish balli to'planmagan: '{ex.title}'")
    if await db.scalar(select(Certificate.id).where(Certificate.student_id == student.id,
                                                    Certificate.group_id == group.id)):
        raise HTTPException(409, "Sertifikat allaqachon berilgan")
    branch = await db.get(Branch, group.branch_id)
    year = today().year
    prefix = f"{branch.code}-{year}-"
    n = await db.scalar(select(func.count(Certificate.id)).where(Certificate.serial_number.like(prefix + "%"))) or 0
    cert = Certificate(student_id=student.id, group_id=group.id, serial_number=f"{prefix}{n + 1:05d}",
                       file_url=data.file_url, issued_at=today(), issued_by=user.id)
    db.add(cert)
    add_audit(db, user, "create", "certificate", None, new={"student_id": student.id, "group_id": group.id})
    await safe_commit(db, "Sertifikat raqami band bo'lib qoldi, qayta urinib ko'ring")
    return cert


@cert_router.get("/", response_model=Page[CertificateResponse])
async def list_certs(db: MyDb, user: ManagerUser, params: Pagination, student_id: int | None = None,
                     group_id: int | None = None):
    stmt = scoped(select(Certificate).join(Group, Group.id == Certificate.group_id), Group.branch_id, user)
    stmt = stmt.order_by(Certificate.id.desc())
    if student_id is not None:
        stmt = stmt.where(Certificate.student_id == student_id)
    if group_id is not None:
        stmt = stmt.where(Certificate.group_id == group_id)
    return await paginate(db, stmt, params)


@cert_router.get("/{cert_id}/pdf")
async def certificate_pdf(cert_id: int, db: MyDb, user: AuthUser):
    """Sertifikatni PDF sifatida yuklab olish (QR kod ochiq tekshirish sahifasiga olib boradi)."""
    c = await check_ident(db, Certificate, cert_id, "Sertifikat topilmadi")
    group = await db.get(Group, c.group_id)
    ensure_branch(user, group.branch_id)
    student, course, branch = await db.get(Student, c.student_id), await db.get(Course, group.course_id), await db.get(Branch, group.branch_id)
    teacher = await db.get(Employee, group.teacher_id) if group.teacher_id else None
    pdf = await asyncio.to_thread(
        build_certificate_pdf, student_name=f"{student.first_name} {student.last_name}", course_name=course.name, group_name=group.name,
        serial=c.serial_number, issued_at=c.issued_at, center_name=settings.CENTER_NAME, branch_name=branch.name,
        verify_url=f"{settings.FRONTEND_URL.rstrip('/')}/verify/{c.serial_number}",
        teacher_name=f"{teacher.first_name} {teacher.last_name}" if teacher else None)
    return Response(pdf, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="sertifikat-{c.serial_number}.pdf"'})


@cert_router.delete("/{cert_id}", response_model=Message)
async def revoke(cert_id: int, db: MyDb, user: ManagerUser):
    c = await check_ident(db, Certificate, cert_id, "Sertifikat topilmadi")
    g = await db.get(Group, c.group_id)
    ensure_branch(user, g.branch_id)
    add_audit(db, user, "delete", "certificate", c.id, old={"serial_number": c.serial_number})
    await db.delete(c)
    await safe_commit(db)
    return Message(msg="Sertifikat bekor qilindi")
