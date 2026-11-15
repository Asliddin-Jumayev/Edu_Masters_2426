import datetime as dt
from sqlalchemy import DateTime, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from app.utils.time import utcnow


class Base(DeclarativeBase):
    pass


class CreatedAtMixin:
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime, default=utcnow, server_default=func.now(), sort_order=1000
    )


class TimestampMixin(CreatedAtMixin):
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime, default=utcnow, onupdate=utcnow, server_default=func.now(), sort_order=1001
    )
