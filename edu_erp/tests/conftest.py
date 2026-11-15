import os
import tempfile
from pathlib import Path

_tmp = Path(tempfile.mkdtemp())
os.environ.update(
    SECRET_KEY="test-secret-key-1234567890-abcdef",
    DATABASE_URL=f"sqlite+aiosqlite:///{_tmp}/test.db",
    BACKGROUND_TASKS="false",
    LOGIN_RATE_LIMIT="1000/minute",
    UPLOAD_DIR=str(_tmp / "uploads"),
)

import pytest_asyncio  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402

ADMIN_PHONE, ADMIN_PASS = "+998901112233", "AdminPass123"


@pytest_asyncio.fixture(scope="session")
async def client():
    import app.models  # noqa: F401
    from app.database.base import Base
    from app.database.connection import SessionLocal, engine
    from app.main import app
    from app.seed import seed_all

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with SessionLocal() as db:
        await seed_all(db, ADMIN_PHONE, ADMIN_PASS)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    await engine.dispose()
