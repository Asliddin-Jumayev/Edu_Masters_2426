import datetime as dt
from decimal import Decimal
from typing import Optional
from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, String, Text, false, text, true
from sqlalchemy.orm import Mapped, mapped_column
from app.database.base import Base, CreatedAtMixin
from app.models.enums import SmsStatus, db_enum


class SmsTemplate(Base):
    __tablename__ = "sms_templates"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(40), unique=True)
    body: Mapped[str] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default=true())


class SmsLog(CreatedAtMixin, Base):
    __tablename__ = "sms_logs"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    template_id: Mapped[Optional[int]] = mapped_column(ForeignKey("sms_templates.id"))
    student_id: Mapped[Optional[int]] = mapped_column(ForeignKey("students.id"))
    lead_id: Mapped[Optional[int]] = mapped_column(ForeignKey("leads.id"))
    recipient_phone: Mapped[str] = mapped_column(String(20))
    body: Mapped[str] = mapped_column(Text)
    status: Mapped[SmsStatus] = mapped_column(db_enum(SmsStatus), default=SmsStatus.QUEUED)
    cost: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"), server_default=text("0"))
    sent_at: Mapped[Optional[dt.datetime]] = mapped_column(DateTime)
    provider_message_id: Mapped[Optional[str]] = mapped_column(String(64), index=True)  # yangi: yetkazish holati callback i uchun
    error: Mapped[Optional[str]] = mapped_column(String(255))                          # yangi


class Notification(CreatedAtMixin, Base):
    __tablename__ = "notifications"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id"))
    type: Mapped[str] = mapped_column(String(40))
    title: Mapped[str] = mapped_column(String(160))
    body: Mapped[Optional[str]] = mapped_column(Text)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())
