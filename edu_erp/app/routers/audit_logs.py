import datetime as dt
from fastapi import APIRouter
from sqlalchemy import select
from app.models.system import AuditLog
from app.schemes.communication import AuditLogResponse
from app.utils.deps import MyDb
from app.utils.pagination import Page, Pagination, paginate
from app.utils.permissions import AdminUser

router = APIRouter(prefix="/audit-logs", tags=["System"])


@router.get("/", response_model=Page[AuditLogResponse])
async def list_audit(db: MyDb, user: AdminUser, params: Pagination, entity_type: str | None = None,
                     entity_id: int | None = None, employee_id: int | None = None, action: str | None = None,
                     date_from: dt.date | None = None, date_to: dt.date | None = None):
    stmt = select(AuditLog).order_by(AuditLog.id.desc())
    if entity_type:
        stmt = stmt.where(AuditLog.entity_type == entity_type)
    if entity_id is not None:
        stmt = stmt.where(AuditLog.entity_id == entity_id)
    if employee_id is not None:
        stmt = stmt.where(AuditLog.employee_id == employee_id)
    if action:
        stmt = stmt.where(AuditLog.action == action)
    if date_from:
        stmt = stmt.where(AuditLog.created_at >= dt.datetime.combine(date_from, dt.time.min))
    if date_to:
        stmt = stmt.where(AuditLog.created_at <= dt.datetime.combine(date_to, dt.time.max))
    return await paginate(db, stmt, params)
