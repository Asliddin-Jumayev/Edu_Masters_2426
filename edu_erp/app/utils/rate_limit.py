from slowapi import Limiter
from slowapi.util import get_remote_address

# Proxy (nginx) orqasida ishlasangiz uvicorn ga --proxy-headers bering.
limiter = Limiter(key_func=get_remote_address)
