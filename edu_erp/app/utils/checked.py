from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError


async def check_ident(db, model, ident, detail: str | None = None):
    obj = await db.get(model, ident)
    if obj is None:
        raise HTTPException(404, detail or f"{model.__name__} topilmadi")
    return obj


async def ensure_unique(db, column, value, *, exclude_id: int | None = None,
                        msg: str = "Bunday yozuv allaqachon mavjud"):
    model = column.class_
    stmt = select(model.id).where(column == value)
    if exclude_id is not None:
        stmt = stmt.where(model.id != exclude_id)
    if await db.scalar(stmt.limit(1)) is not None:
        raise HTTPException(409, msg)


def _explain(exc: IntegrityError) -> str:
    text = str(getattr(exc, "orig", exc)).lower()
    if "duplicate" in text or "unique" in text:
        return "Bunday yozuv allaqachon mavjud"
    if "foreign key" in text or "cannot add or update" in text or "cannot delete" in text:
        return "Bog'langan yozuvlar mavjud yoki noto'g'ri bog'lanish ko'rsatilgan"
    return "Ma'lumotlar bazasi cheklovi buzildi"


async def safe_commit(db, msg: str | None = None):
    """commit; poyga holatidagi unique/FK xatolarini 500 o'rniga 409 qilib qaytaradi."""
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(409, msg or _explain(exc))
