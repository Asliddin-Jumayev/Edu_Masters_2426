"""Dars jadvali va to'qnashuvlar. MySQL da EXCLUDE constraint yo'q, shuning uchun servis qatlamida."""
import datetime as dt
from fastapi import HTTPException
from sqlalchemy import func, select
from app.models.enums import GroupStatus, SessionStatus
from app.models.groups import Group
from app.models.lessons import GroupSchedule, LessonSession


async def session_conflict(db, *, teacher_id, room_id, day: dt.date, start: dt.time, end: dt.time,
                           exclude_id: int | None = None) -> str | None:
    stmt = select(LessonSession).where(
        LessonSession.date == day, LessonSession.status != SessionStatus.CANCELLED,
        LessonSession.start_time < end, LessonSession.end_time > start)
    if exclude_id:
        stmt = stmt.where(LessonSession.id != exclude_id)
    for s in (await db.execute(stmt)).scalars().all():
        if teacher_id and s.teacher_id == teacher_id:
            return f"{day}: o'qituvchi shu vaqtda boshqa darsda (guruh #{s.group_id})"
        if room_id and s.room_id == room_id:
            return f"{day}: xona shu vaqtda band (guruh #{s.group_id})"
    return None


async def schedule_conflict(db, *, group: Group, weekday: int, start: dt.time, end: dt.time,
                            room_id: int | None, exclude_id: int | None = None) -> str | None:
    stmt = (select(GroupSchedule, Group).join(Group, Group.id == GroupSchedule.group_id)
            .where(Group.id != group.id, Group.status.in_([GroupStatus.PLANNED, GroupStatus.ACTIVE]),
                   GroupSchedule.weekday == weekday, GroupSchedule.start_time < end, GroupSchedule.end_time > start))
    if exclude_id:
        stmt = stmt.where(GroupSchedule.id != exclude_id)
    eff_room = room_id or group.room_id
    for sched, other in (await db.execute(stmt)).all():
        other_room = sched.room_id or other.room_id
        if eff_room and other_room == eff_room:
            return f"Xona shu vaqtda '{other.name}' guruhi uchun band"
        if group.teacher_id and other.teacher_id == group.teacher_id:
            return f"O'qituvchi shu vaqtda '{other.name}' guruhida dars beradi"
    return None


async def generate_sessions(db, group: Group, date_from: dt.date, date_to: dt.date) -> dict:
    if date_to < date_from:
        raise HTTPException(400, "date_to date_from dan oldin bo'lmasligi kerak")
    if (date_to - date_from).days > 366:
        raise HTTPException(400, "Oraliq 366 kundan oshmasligi kerak")
    schedules = (await db.execute(select(GroupSchedule).where(GroupSchedule.group_id == group.id))).scalars().all()
    if not schedules:
        raise HTTPException(400, "Guruhda dars jadvali yo'q")
    created = skipped = 0
    conflicts: list[str] = []
    day = date_from
    while day <= date_to:
        for sc in (s for s in schedules if s.weekday == day.isoweekday()):
            exists = await db.scalar(select(func.count(LessonSession.id)).where(
                LessonSession.group_id == group.id, LessonSession.date == day,
                LessonSession.start_time == sc.start_time))
            if exists:
                skipped += 1
                continue
            room = sc.room_id or group.room_id
            msg = await session_conflict(db, teacher_id=group.teacher_id, room_id=room, day=day,
                                         start=sc.start_time, end=sc.end_time)
            if msg:
                conflicts.append(msg)
                continue
            db.add(LessonSession(group_id=group.id, teacher_id=group.teacher_id, room_id=room, date=day,
                                 start_time=sc.start_time, end_time=sc.end_time))
            await db.flush()
            created += 1
        day += dt.timedelta(days=1)
    return {"created": created, "skipped_existing": skipped, "conflicts": conflicts}
