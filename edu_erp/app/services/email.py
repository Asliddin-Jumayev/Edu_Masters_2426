"""Email yuborish: SMTP (haqiqiy), console (log) yoki memory (testlar uchun).
EMAIL_BACKEND=auto: SMTP_HOST yoki DEFAULT_SMTP_HOST orqali smtp ishlaydi."""
import asyncio
import html
import logging
import smtplib
from dataclasses import dataclass
from email.message import EmailMessage
from email.utils import formataddr
from app.utils.config import settings

log = logging.getLogger("email")

# Agar .env da SMTP_HOST bo'sh bo'lsa ham, avtomatik shu Gmail SMTP ishlatiladi:
DEFAULT_SMTP_HOST = "smtp.gmail.com"
DEFAULT_SMTP_PORT = 587
DEFAULT_SMTP_USER = "jumayevasliddin1331@gmail.com"
DEFAULT_SMTP_PASS = "oinnakbuivtmmqpy"


@dataclass
class Outgoing:
    to: str
    subject: str
    text: str
    html: str | None = None


OUTBOX: list[Outgoing] = []  # faqat EMAIL_BACKEND=memory


def _smtp_host() -> str:
    return (settings.SMTP_HOST or DEFAULT_SMTP_HOST).strip()


def _smtp_user() -> str:
    return (settings.SMTP_USER or DEFAULT_SMTP_USER).strip()


def _smtp_pass() -> str:
    return (settings.SMTP_PASSWORD or DEFAULT_SMTP_PASS).replace(" ", "").strip()


def backend_name() -> str:
    b = settings.EMAIL_BACKEND.lower()
    if b in ("auto", "console"):
        return "smtp" if (_smtp_host() and _smtp_user() and _smtp_pass()) else "console"
    return b


def is_configured() -> bool:
    return backend_name() != "smtp" or bool(_smtp_host() and _smtp_user())


def _build(m: Outgoing) -> EmailMessage:
    msg = EmailMessage()
    user = _smtp_user()
    # Gmail begona domendan (noreply@example.uz) xat yuborishni rad etmasligi uchun:
    raw_from = (settings.SMTP_FROM or "").strip()
    sender = user if (not raw_from or "example.uz" in raw_from) else raw_from
    msg["From"] = formataddr((settings.CENTER_NAME, sender)) if "<" not in sender else sender
    msg["To"] = m.to
    msg["Subject"] = m.subject
    msg.set_content(m.text)
    if m.html:
        msg.add_alternative(m.html, subtype="html")
    return msg


def _smtp_send(msg: EmailMessage) -> None:
    host = _smtp_host()
    port = int(settings.SMTP_PORT or DEFAULT_SMTP_PORT)
    user = _smtp_user()
    password = _smtp_pass()

    if settings.SMTP_SSL:
        server: smtplib.SMTP = smtplib.SMTP_SSL(host, port, timeout=20)
    else:
        server = smtplib.SMTP(host, port, timeout=20)
    try:
        server.ehlo()
        if settings.SMTP_STARTTLS and not settings.SMTP_SSL:
            server.starttls()
            server.ehlo()
        if user:
            server.login(user, password)
        server.send_message(msg)
    finally:
        try:
            server.quit()
        except Exception:  # noqa: BLE001
            pass


async def send_email(to: str, subject: str, text: str, html_body: str | None = None) -> None:
    """Xato bo'lsa istisno ko'taradi (chaqiruvchi hal qiladi: fon vazifasida log, test-emailda foydalanuvchiga)."""
    m = Outgoing(to, subject, text, html_body)
    b = backend_name()
    if b == "memory":
        OUTBOX.append(m)
    elif b == "console":
        log.info("EMAIL (console) -> %s | %s\n%s", to, subject, text)
    else:
        await asyncio.to_thread(_smtp_send, _build(m))
        log.info("SMTP EMAIL YUBORILDI -> %s | %s", to, subject)


async def send_email_safe(to: str, subject: str, text: str, html_body: str | None = None) -> bool:
    try:
        await send_email(to, subject, text, html_body)
        return True
    except Exception:  # noqa: BLE001  (login jarayonini hech qachon buzmaymiz)
        log.exception("Email yuborib bo'lmadi: %s", to)
        return False


# ---------------- shablonlar ----------------
def new_device_message(*, name: str, label: str, ip: str, when: str, profile_url: str) -> tuple[str, str, str]:
    """(mavzu, matn, html). Hamma dinamik qiymat HTML uchun escape qilinadi (User-Agent mijozdan keladi!)."""
    center = settings.CENTER_NAME
    subject = f"{center}: yangi qurilmadan kirildi"
    text = (f"Salom, {name}!\n\nHisobingizga yangi qurilmadan kirildi:\n"
            f"  Qurilma: {label}\n  IP manzil: {ip}\n  Vaqt: {when}\n\n"
            f"Agar bu siz bo'lsangiz — hech narsa qilish shart emas.\n"
            f"Agar bu siz bo'lmasangiz, zudlik bilan parolingizni o'zgartiring: {profile_url}\n"
            f"va ma'muriyatga xabar bering.\n\n— {center}")
    e = html.escape
    page = f"""<!doctype html><html><body style="margin:0;background:#f3f5fa;font-family:Arial,Helvetica,sans-serif;color:#19214f">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border:1px solid #d8dcec;border-radius:10px">
<tr><td style="padding:20px 24px;border-bottom:1px solid #d8dcec;font-size:18px;font-weight:bold"><span style="background:#ffdf4d;padding:2px 8px;border-radius:6px">{e(center)}</span></td></tr>
<tr><td style="padding:24px"><h2 style="margin:0 0 12px;font-size:20px">Yangi qurilmadan kirildi</h2>
<p style="margin:0 0 16px;line-height:1.5">Salom, {e(name)}! Hisobingizga yangi qurilmadan kirildi:</p>
<table role="presentation" cellpadding="6" cellspacing="0" style="background:#f3f5fa;border-radius:8px;width:100%;font-size:14px">
<tr><td style="color:#5b6488;width:110px">Qurilma</td><td><b>{e(label)}</b></td></tr>
<tr><td style="color:#5b6488">IP manzil</td><td><b>{e(ip)}</b></td></tr>
<tr><td style="color:#5b6488">Vaqt</td><td><b>{e(when)}</b></td></tr></table>
<p style="margin:16px 0;line-height:1.5">Agar bu siz bo'lsangiz — hech narsa qilish shart emas.</p>
<p style="margin:0 0 20px;line-height:1.5;color:#c7243f"><b>Agar bu siz bo'lmasangiz</b>, zudlik bilan parolingizni o'zgartiring va ma'muriyatga xabar bering.</p>
<a href="{e(profile_url, quote=True)}" style="display:inline-block;background:#2b3a9c;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:bold">Parolni o'zgartirish</a></td></tr>
<tr><td style="padding:14px 24px;border-top:1px solid #d8dcec;font-size:12px;color:#5b6488">Bu xabar avtomatik yuborildi. Unga javob bermang.</td></tr>
</table></td></tr></table></body></html>"""
    return subject, text, page


def make_test_message(name: str) -> tuple[str, str, str]:
    c = settings.CENTER_NAME
    return (f"{c}: test xati", f"Salom, {name}! Email sozlamalari to'g'ri ishlayapti.\n— {c}",
            f"<p>Salom, {html.escape(name)}! Email sozlamalari to'g'ri ishlayapti.</p><p>— {html.escape(c)}</p>")