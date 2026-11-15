import datetime as dt
from decimal import Decimal
from typing import Literal
from pydantic import BaseModel, Field
from app.schemes.common import ORM, Phone, PositiveMoney

EMAIL = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"


class OnlineCheckout(BaseModel):
    student_id: int
    amount: PositiveMoney
    provider: Literal["click", "payme"]
    invoice_id: int | None = None
    return_url: str | None = Field(None, max_length=300)
    send_sms: bool = False  # havolani ota-onaga SMS orqali yuborish


class OnlineCheckoutResponse(BaseModel):
    payment_id: int
    provider: str
    url: str
    amount: Decimal
    sms_sent: bool = False


class ProviderTxResponse(ORM):
    id: int
    provider: str
    provider_trans_id: str
    payment_id: int
    amount: Decimal
    state: int
    perform_time: dt.datetime | None
    cancel_time: dt.datetime | None
    reason: int | None
    created_at: dt.datetime


class DeviceResponse(BaseModel):
    id: int
    label: str
    first_ip: str | None
    last_ip: str | None
    first_seen_at: dt.datetime
    last_seen_at: dt.datetime
    login_count: int
    is_current: bool = False


class EmailUpdate(BaseModel):
    email: str = Field(pattern=EMAIL, max_length=255)
    password: str


class TestSms(BaseModel):
    phone: Phone
    text: str | None = Field(None, max_length=300)


class TestEmail(BaseModel):
    to: str | None = Field(None, pattern=EMAIL, max_length=255)


class TestResult(BaseModel):
    ok: bool
    detail: str | None = None


class ProviderStatus(BaseModel):
    configured: bool
    urls: dict[str, str] = {}
    info: dict[str, str | bool | None] = {}


class IntegrationsStatus(BaseModel):
    click: ProviderStatus
    payme: ProviderStatus
    sms: ProviderStatus
    email: ProviderStatus
    public_api_url: str
    frontend_url: str
