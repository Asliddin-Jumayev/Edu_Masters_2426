import datetime as dt
from sqlalchemy import Boolean, Date, String, Text, true
from sqlalchemy.orm import Mapped, mapped_column
from app.database.base import Base, CreatedAtMixin


class Branch(CreatedAtMixin, Base):
    __tablename__ = "branches"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(120))
    code: Mapped[str] = mapped_column(String(20), unique=True)
    address: Mapped[str] = mapped_column(Text)
    phone: Mapped[str] = mapped_column(String(20))
    city: Mapped[str] = mapped_column(String(60))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default=true())
    opened_at: Mapped[dt.date] = mapped_column(Date)
