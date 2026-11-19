"""Two-Factor Authentication (2FA / TOTP RFC 6238).

Standart Google Authenticator, Duo va boshqa TOTP ilovalari bilan 100% mos.
Tashqi paket talab qilmaydi — Python standart `hmac`, `hashlib`, `base64` orqali ishlaydi.

Foydalanish:
    secret = generate_totp_secret()
    uri = get_totp_uri(secret, "Ali Karimov", "Edu Masters")
    is_valid = verify_totp(secret, "123456")
"""
import base64
import hashlib
import hmac
import os
import struct
import time
import urllib.parse


def generate_totp_secret() -> str:
    """160-bit (20 bayt) tasodifiy base32 maxfiy kalit yaratadi."""
    return base64.b32encode(os.urandom(20)).decode("utf-8").replace("=", "")


def get_totp_code(secret: str, time_step: int | None = None) -> str:
    """Berilgan vaqt (yoki joriy vaqt) uchun 6 xonali TOTP kodini hisoblaydi."""
    if time_step is None:
        time_step = int(time.time() // 30)

    # Base32 kalitni baytga aylantiramiz
    padding = "=" * ((8 - len(secret) % 8) % 8)
    key = base64.b32decode(secret.upper() + padding)

    # Vaqt hisoblagichi (8 bayt big-endian)
    msg = struct.pack(">Q", time_step)

    # HMAC-SHA1
    h = hmac.new(key, msg, hashlib.sha1).digest()

    # Dynamic truncation (oxirgi baytning quyi 4 biti offset)
    offset = h[-1] & 0x0F
    code_int = struct.unpack(">I", h[offset:offset + 4])[0] & 0x7FFFFFFF
    code = code_int % 1_000_000

    return f"{code:06d}"


def verify_totp(secret: str, code: str, window: int = 1) -> bool:
    """
    Kodni tekshiradi.
    window=1 -> soat drifti uchun -30s va +30s oralig'idagi kodlarni ham qabul qiladi.
    """
    if not secret or not code or len(code.strip()) != 6:
        return False
    code = code.strip()
    current_step = int(time.time() // 30)

    for step in range(current_step - window, current_step + window + 1):
        if hmac.compare_digest(get_totp_code(secret, step), code):
            return True
    return False


def get_totp_uri(secret: str, account_name: str, issuer: str = "Edu Masters") -> str:
    """Google Authenticator skanerlashi uchun `otpauth://` formatidagi havola."""
    label = urllib.parse.quote(f"{issuer}:{account_name}")
    params = urllib.parse.urlencode({
        "secret": secret,
        "issuer": issuer,
        "algorithm": "SHA1",
        "digits": "6",
        "period": "30",
    })
    return f"otpauth://totp/{label}?{params}"
