from app.models.communication import Notification, SmsLog
from app.models.enums import SmsStatus
from app.services.sms_providers import get_provider
from app.utils.time import utcnow


class _Safe(dict):
    def __missing__(self, key):
        return "{" + key + "}"


def render(body: str, ctx: dict) -> str:
    return body.format_map(_Safe(ctx))


async def deliver_sms(db, *, phone: str, body: str, template_id=None, student_id=None, lead_id=None) -> SmsLog:
    """SMS ni provayder orqali yuboradi va natijani sms_logs ga yozadi (commit chaqiruvchida)."""
    row = SmsLog(template_id=template_id, student_id=student_id, lead_id=lead_id, recipient_phone=phone, body=body, status=SmsStatus.QUEUED)
    db.add(row)
    await db.flush()
    await _send(row)
    return row


async def _send(row: SmsLog) -> None:
    res = await get_provider().send(row.recipient_phone, row.body)
    row.status = SmsStatus.SENT if res.ok else SmsStatus.FAILED
    row.cost = res.cost
    row.sent_at = utcnow() if res.ok else None
    row.provider_message_id = res.message_id
    row.error = None if res.ok else (res.error or "Noma'lum xato")[:255]


async def resend_sms(row: SmsLog) -> None:
    await _send(row)


def notify(db, employee_id: int, type_: str, title: str, body: str | None = None):
    db.add(Notification(employee_id=employee_id, type=type_, title=title, body=body))
