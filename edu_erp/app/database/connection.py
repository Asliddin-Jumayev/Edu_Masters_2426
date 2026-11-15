from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from app.utils.config import settings

engine = create_async_engine(
    settings.async_database_url,
    pool_pre_ping=True,   # uzilgan ulanishni avtomatik tiklaydi
    pool_recycle=1800,    # MySQL wait_timeout dan oldin ulanishni yangilaydi
)
SessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)


async def get_db():
    async with SessionLocal() as db:
        yield db
