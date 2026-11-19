import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app import models as _models  # noqa: F401  (hamma modellar mapperga yuklansin)
from app.admin.admin_setup import setup_admin
from app.database.connection import SessionLocal, engine
from app.routers import all_routers
from app.routers.versioned import v1_router
from app.routers.ws import manager as ws_manager
from app.services.finance import mark_overdue
from app.subapps.metrics_app import metrics_subapp
from app.utils.cache import close_redis, init_redis
from app.utils.config import settings
from app.utils.rate_limit import limiter

# Ilova loglari (console email/SMS, webhooklar) ko'rinishi uchun: uvicorn faqat o'z loggerlarini sozlaydi
logging.basicConfig(level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO), format="%(levelname)s [%(name)s] %(message)s")
log = logging.getLogger("app")


async def _overdue_loop():
    """Har soatda muddati o'tgan hisoblarni 'overdue' qiladi (idempotent, ko'p worker bo'lsa ham zarar yo'q)."""
    while True:
        try:
            async with SessionLocal() as db:
                await mark_overdue(db)
        except asyncio.CancelledError:
            raise
        except Exception:
            log.exception("overdue loop xatosi")
        await asyncio.sleep(3600)


@asynccontextmanager
async def lifespan(_: FastAPI):
    # 1. Redis kesh ulanishi (agar sozlangan bo'lsa)
    await init_redis(settings.REDIS_URL)

    # 2. WebSocket Redis Pub/Sub (production scale)
    if settings.REDIS_URL:
        await ws_manager.init_redis_pubsub(settings.REDIS_URL)

    # 3. Fon vazifasi
    task = asyncio.create_task(_overdue_loop()) if settings.BACKGROUND_TASKS else None

    yield

    # To'xtatish (graceful shutdown)
    if task:
        task.cancel()
    await ws_manager.close()
    await close_redis()
    await engine.dispose()


app = FastAPI(title="Edu Masters system API", version="1.0", docs_url="/", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(
    CORSMiddleware, allow_origins=settings.cors_origins_list, allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

# 1. To'g'ridan-to'g'ri routerlar (orqaga moslik uchun: /auth/login, /branches/...)
for r in all_routers:
    app.include_router(r)

# 2. API Versioning (/api/v1/auth/login, /api/v1/students/...)
app.include_router(v1_router)

# 3. Sub-applications va Mounting (/internal/metrics)
app.mount("/internal/metrics", metrics_subapp)

# 4. Starlette-Admin paneli (/admin)
setup_admin(app, engine)


@app.get("/health", tags=["System"])
async def health():
    return {"status": "ok"}
