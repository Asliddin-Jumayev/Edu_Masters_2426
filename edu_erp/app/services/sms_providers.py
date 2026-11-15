"""SMS provayderlar. Hozir: Eskiz.uz (haqiqiy) va console (rivojlantirish uchun, faqat logga yozadi).

Yangi provayder qo'shish: send(phone, text) -> SendResult metodli klass yozing va build_provider() ga ulang."""
import logging
import re
import time
import uuid
from dataclasses import dataclass
from decimal import Decimal
import httpx
from app.models.enums import SmsStatus
from app.utils.config import settings

log = logging.getLogger("sms")


@dataclass
class SendResult:
    ok: bool
    message_id: str | None = None
    error: str | None = None
    cost: Decimal = Decimal("0")


def msisdn(phone: str) -> str:
    """+998 90 123 45 67 -> 998901234567 (Eskiz '+' siz raqam kutadi)"""
    return re.sub(r"\D", "", phone)


class ConsoleProvider:
    name = "console"

    async def send(self, phone: str, text: str) -> SendResult:
        log.info("SMS (console) -> %s: %s", phone, text)
        return SendResult(True, f"console-{uuid.uuid4().hex[:12]}")


class NotConfiguredProvider:
    name = "eskiz"

    async def send(self, phone: str, text: str) -> SendResult:
        return SendResult(False, error="SMS provayder sozlanmagan (ESKIZ_EMAIL / ESKIZ_PASSWORD)")


class EskizProvider:
    """Eskiz.uz Notify API: POST /auth/login -> token (30 kun), POST /message/sms/send (Bearer)."""
    name = "eskiz"

    def __init__(self, email: str, password: str, sender: str = "4546", base_url: str = "https://notify.eskiz.uz/api",
                 callback_url: str | None = None, transport: httpx.AsyncBaseTransport | None = None):
        self.email, self.password, self.sender = email, password, sender
        self.base = base_url.rstrip("/")
        self.callback_url = callback_url
        self._transport = transport
        self._token: str | None = None
        self._token_exp = 0.0

    def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(timeout=15, transport=self._transport)

    async def _login(self, client: httpx.AsyncClient) -> str:
        r = await client.post(f"{self.base}/auth/login", data={"email": self.email, "password": self.password})
        r.raise_for_status()
        self._token = r.json()["data"]["token"]
        self._token_exp = time.time() + 25 * 24 * 3600  # token 30 kun yashaydi, zaxira bilan yangilaymiz
        return self._token

    async def send(self, phone: str, text: str) -> SendResult:
        payload = {"mobile_phone": msisdn(phone), "message": text, "from": self.sender}
        if self.callback_url:
            payload["callback_url"] = self.callback_url
        try:
            async with self._client() as client:
                token = self._token if self._token and time.time() < self._token_exp else await self._login(client)
                r = await client.post(f"{self.base}/message/sms/send", headers={"Authorization": f"Bearer {token}"}, data=payload)
                if r.status_code == 401:  # token eskirgan — bir marta qayta kirib urinamiz
                    token = await self._login(client)
                    r = await client.post(f"{self.base}/message/sms/send", headers={"Authorization": f"Bearer {token}"}, data=payload)
        except httpx.HTTPError as e:
            log.warning("Eskiz tarmoq xatosi: %s", e)
            return SendResult(False, error=f"Eskiz bilan aloqa xatosi ({e.__class__.__name__})")
        except (KeyError, ValueError):
            return SendResult(False, error="Eskiz javobi tushunarsiz")
        try:
            data = r.json()
        except ValueError:
            data = {}
        if r.status_code == 200 and data.get("id"):
            return SendResult(True, str(data["id"]))
        return SendResult(False, error=str(data.get("message") or r.text or f"HTTP {r.status_code}")[:250])


def map_delivery_status(raw: str | None) -> SmsStatus | None:
    """Provayder yetkazish holati matnini bizning holatga aylantiradi."""
    s = (raw or "").strip().lower()
    if not s:
        return None
    if any(k in s for k in ("delivrd", "delivered", "yetkaz")):
        return SmsStatus.DELIVERED
    if any(k in s for k in ("reject", "fail", "undeliv", "expired", "error", "blocked")):
        return SmsStatus.FAILED
    if any(k in s for k in ("sent", "waiting", "accepted", "process", "transmit")):
        return SmsStatus.SENT
    return None


def build_provider():
    if settings.SMS_PROVIDER.lower() == "eskiz":
        if not (settings.ESKIZ_EMAIL and settings.ESKIZ_PASSWORD):
            return NotConfiguredProvider()
        cb = None
        if settings.PUBLIC_API_URL and settings.SMS_CALLBACK_TOKEN:
            cb = f"{settings.PUBLIC_API_URL.rstrip('/')}/webhooks/sms/eskiz?token={settings.SMS_CALLBACK_TOKEN}"
        return EskizProvider(settings.ESKIZ_EMAIL, settings.ESKIZ_PASSWORD, settings.ESKIZ_FROM, settings.ESKIZ_BASE_URL, cb)
    return ConsoleProvider()


_provider = None


def get_provider():
    global _provider
    if _provider is None:
        _provider = build_provider()
    return _provider


def set_provider(p) -> None:
    """Testlar uchun yoki sozlama o'zgargach qayta qurish uchun (None = qayta quriladi)."""
    global _provider
    _provider = p
