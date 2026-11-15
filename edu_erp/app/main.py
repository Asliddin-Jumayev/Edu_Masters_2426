import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app import models as _models  # noqa: F401  (hamma modellar mapperga yuklansin)
from app.database.connection import SessionLocal, engine
from app.routers import all_routers
from app.services.finance import mark_overdue
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
    task = asyncio.create_task(_overdue_loop()) if settings.BACKGROUND_TASKS else None
    yield
    if task:
        task.cancel()
    await engine.dispose()


app = FastAPI(title="Edu Masters system API", version="1.0", docs_url="/", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(
    CORSMiddleware, allow_origins=settings.cors_origins_list, allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

for r in all_routers:
    app.include_router(r)


@app.get("/health", tags=["System"])
async def health():
    return {"status": "ok"}
