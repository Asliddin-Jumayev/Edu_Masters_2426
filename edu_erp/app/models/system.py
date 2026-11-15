import datetime as dt
from typing import Optional
from sqlalchemy import Boolean, DateTime, ForeignKey, Index, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.database.base import Base, CreatedAtMixin
from app.utils.time import utcnow


class AuditLog(CreatedAtMixin, Base):
    __tablename__ = "audit_logs"
    __table_args__ = (Index("ix_audit_entity", "entity_type", "entity_id"),)
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    employee_id: Mapped[Optional[int]] = mapped_column(ForeignKey("employees.id"))
    action: Mapped[str] = mapped_column(String(20))
    entity_type: Mapped[str] = mapped_column(String(60))
    entity_id: Mapped[Optional[int]]
    old_values: Mapped[Optional[dict]] = mapped_column(JSON)
    new_values: Mapped[Optional[dict]] = mapped_column(JSON)


class Attachment(CreatedAtMixin, Base):
    __tablename__ = "attachments"
    __table_args__ = (Index("ix_attachment_entity", "entity_type", "entity_id"),)
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    entity_type: Mapped[str] = mapped_column(String(60))
    entity_id: Mapped[int]
    file_url: Mapped[str] = mapped_column(Text)
    file_name: Mapped[str] = mapped_column(String(255))
    uploaded_by: Mapped[int] = mapped_column(ForeignKey("employees.id"))


class LoginDevice(Base):
    """Xodim tizimga kirgan qurilmalar. Yangi qurilmadan kirilsa email/ichki xabarnoma yuboriladi."""
    __tablename__ = "login_devices"
    __table_args__ = (UniqueConstraint("employee_id", "device_hash", name="uq_login_device"),)
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id"), index=True)
    device_hash: Mapped[str] = mapped_column(String(64))          # sha256(device id) — xom identifikator saqlanmaydi
    label: Mapped[str] = mapped_column(String(120))               # "Chrome · Windows"
    user_agent: Mapped[Optional[str]] = mapped_column(String(255))
    first_ip: Mapped[Optional[str]] = mapped_column(String(45))
    last_ip: Mapped[Optional[str]] = mapped_column(String(45))
    first_seen_at: Mapped[dt.datetime] = mapped_column(DateTime, default=utcnow)
    last_seen_at: Mapped[dt.datetime] = mapped_column(DateTime, default=utcnow)
    login_count: Mapped[int] = mapped_column(default=1)
    alerted: Mapped[bool] = mapped_column(Boolean, default=False)  # xabarnoma yuborilganmi
