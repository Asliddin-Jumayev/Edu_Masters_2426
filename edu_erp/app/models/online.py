import datetime as dt
from decimal import Decimal
from typing import Optional
from sqlalchemy import BigInteger, DateTime, ForeignKey, Numeric, SmallInteger, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.database.base import Base, CreatedAtMixin


class ProviderTransaction(CreatedAtMixin, Base):
    """Click/Payme tomonidagi tranzaksiya. payments.id = buyurtma raqami (order id).

    state (Payme semantikasi, Click uchun ham): 1 = yaratildi, 2 = bajarildi, -1 = bajarilmasdan bekor, -2 = bajarilgandan keyin bekor.
    created_at = tranzaksiya yaratilgan vaqt (Payme create_time)."""
    __tablename__ = "provider_transactions"
    __table_args__ = (UniqueConstraint("provider", "provider_trans_id", name="uq_provider_txn"),)
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    provider: Mapped[str] = mapped_column(String(10))
    provider_trans_id: Mapped[str] = mapped_column(String(64))
    payment_id: Mapped[int] = mapped_column(ForeignKey("payments.id"), index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    state: Mapped[int] = mapped_column(SmallInteger, default=1)
    provider_time: Mapped[Optional[int]] = mapped_column(BigInteger)       # Payme "time" (ms)
    perform_time: Mapped[Optional[dt.datetime]] = mapped_column(DateTime)
    cancel_time: Mapped[Optional[dt.datetime]] = mapped_column(DateTime)
    reason: Mapped[Optional[int]] = mapped_column(SmallInteger)
