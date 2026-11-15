from fastapi import HTTPException
from sqlalchemy import func, select
from app.models.courses import Course
from app.models.enums import EnrollmentStatus, GroupStatus, StudentStatus
from app.models.groups import Group
from app.models.students import Enrollment, Student
from app.utils.time import today


async def recount_group(db, group: Group):
    group.current_students = await db.scalar(
        select(func.count(Enrollment.id)).where(Enrollment.group_id == group.id,
                                                Enrollment.status == EnrollmentStatus.ACTIVE)) or 0


async def enroll_student(db, student: Student, group_id: int, price=None, joined_at=None) -> Enrollment:
    group = await db.get(Group, group_id, with_for_update=True, populate_existing=True)  # sig'im poygasi
    if group is None:
        raise HTTPException(404, "Guruh topilmadi")
    if group.status not in (GroupStatus.PLANNED, GroupStatus.ACTIVE):
        raise HTTPException(400, "Faqat rejalashtirilgan yoki faol guruhga yozish mumkin")
    if group.branch_id != student.branch_id:
        raise HTTPException(400, "O'quvchi va guruh filiali bir xil bo'lishi kerak")
    dup = await db.scalar(select(Enrollment.id).where(
        Enrollment.student_id == student.id, Enrollment.group_id == group.id,
        Enrollment.status.in_([EnrollmentStatus.ACTIVE, EnrollmentStatus.FROZEN])))
    if dup:
        raise HTTPException(409, "O'quvchi bu guruhga allaqachon yozilgan")
    await recount_group(db, group)
    if group.current_students >= group.max_students:
        raise HTTPException(409, "Guruh to'lgan")
    if price is None:
        price = group.price if group.price is not None else (await db.get(Course, group.course_id)).price
    enr = Enrollment(student_id=student.id, group_id=group.id, status=EnrollmentStatus.ACTIVE,
                     price=price, joined_at=joined_at or today())
    db.add(enr)
    await db.flush()
    await recount_group(db, group)
    if student.status in (StudentStatus.TRIAL, StudentStatus.LEFT, StudentStatus.GRADUATED):
        student.status = StudentStatus.ACTIVE
    return enr
