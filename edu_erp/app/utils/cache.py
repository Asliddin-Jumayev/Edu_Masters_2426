"""Redis kesh yordamchi moduli.

Agar Redis mavjud bo'lmasa (REDIS_URL bo'sh yoki ulanib bo'lmasa),
kesh avtomatik o'chiriladi va funksiyalar to'g'ridan-to'g'ri ishlaydi.
Bu yerli ishlab chiqish va test muhiti uchun qulay.

Foydalanish:
    @cached(key="dashboard:{branch_id}", ttl=60)
    async def get_dashboard(branch_id: int) -> dict: ...
"""
import json
import logging
from functools import wraps
from typing import Any, Callable

log = logging.getLogger("cache")

try:
    import redis.asyncio as aioredis  # type: ignore
    _HAS_REDIS = True
except ImportError:
    _HAS_REDIS = False

_redis: Any = None


async def init_redis(url: str) -> None:
    """Ilova ishga tushganda Redis ulanishini yaratadi."""
    global _redis
    if not _HAS_REDIS:
        log.warning("redis paketi o'rnatilmagan — kesh o'chirilgan. `pip install redis` bilan o'rnating.")
        return
    if not url:
        log.info("REDIS_URL sozlanmagan — kesh o'chirilgan.")
        return
    try:
        _redis = aioredis.from_url(url, encoding="utf-8", decode_responses=True)
        await _redis.ping()
        log.info("Redis ulanishi muvaffaqiyatli: %s", url)
    except Exception as e:
        log.warning("Redis ulanib bo'lmadi (%s) — kesh o'chirilgan.", e)
        _redis = None


async def close_redis() -> None:
    global _redis
    if _redis is not None:
        await _redis.close()
        _redis = None


async def get(key: str) -> Any | None:
    """Keshdan qiymat oladi. Redis yo'q bo'lsa None qaytaradi."""
    if _redis is None:
        return None
    try:
        raw = await _redis.get(key)
        return json.loads(raw) if raw is not None else None
    except Exception as e:
        log.debug("Kesh o'qish xatosi (%s): %s", key, e)
        return None


async def set(key: str, value: Any, ttl: int = 60) -> None:
    """Keshga qiymat yozadi (TTL soniya). Redis yo'q bo'lsa o'tkazib yuboradi."""
    if _redis is None:
        return
    try:
        await _redis.setex(key, ttl, json.dumps(value, default=str))
    except Exception as e:
        log.debug("Kesh yozish xatosi (%s): %s", key, e)


async def delete(key: str) -> None:
    if _redis is None:
        return
    try:
        await _redis.delete(key)
    except Exception as e:
        log.debug("Kesh o'chirish xatosi (%s): %s", key, e)


async def delete_pattern(pattern: str) -> None:
    """Pattern bo'yicha kesh kalitlarini o'chiradi (masalan 'dashboard:*')."""
    if _redis is None:
        return
    try:
        keys = await _redis.keys(pattern)
        if keys:
            await _redis.delete(*keys)
    except Exception as e:
        log.debug("Kesh pattern o'chirish xatosi (%s): %s", pattern, e)


def cached(key_template: str, ttl: int = 60):
    """
    Dekorator: async funksiya natijasini Redis da keshlaydi.
    key_template da {arg_name} ishlatish mumkin.

    Misol:
        @cached("dashboard:{branch_id}", ttl=60)
        async def dashboard(branch_id: int | None = None): ...
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Kalit ichidagi {placeholder} ni kwargs dan to'ldiramiz
            try:
                cache_key = key_template.format(**kwargs)
            except KeyError:
                cache_key = key_template

            cached_val = await get(cache_key)
            if cached_val is not None:
                return cached_val

            result = await func(*args, **kwargs)
            await set(cache_key, result, ttl=ttl)
            return result
        return wrapper
    return decorator
