import datetime as dt
import enum
from decimal import Decimal
from app.models.system import AuditLog


def _json(v):
    if isinstance(v, Decimal):
        return str(v)
    if isinstance(v, (dt.datetime, dt.date, dt.time)):
        return v.isoformat()
    if isinstance(v, enum.Enum):
        return v.value
    return v


def snapshot(obj, exclude: set[str] | None = None) -> dict:
    exclude = exclude or set()
    return {c.key: _json(getattr(obj, c.key)) for c in obj.__table__.columns if c.key not in exclude}


def add_audit(db, user, action: str, entity_type: str, entity_id: int | None,
              old: dict | None = None, new: dict | None = None):
    db.add(AuditLog(employee_id=getattr(user, "id", None), action=action, entity_type=entity_type,
                    entity_id=entity_id, old_values=old, new_values=new))
