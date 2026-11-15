import os
import uuid
from pathlib import Path
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select
from app.models.crm import Lead
from app.models.employees import Employee
from app.models.finance import Expense
from app.models.students import Student
from app.models.system import Attachment
from app.schemes.common import Message
from app.schemes.communication import AttachmentResponse
from app.utils.access import ensure_branch, has_role, is_admin
from app.utils.checked import check_ident, safe_commit
from app.utils.config import settings
from app.utils.deps import MyDb
from app.utils.permissions import AuthUser
from app.utils.roles import ADMIN, MANAGER, ACCOUNTANT

router = APIRouter(prefix="/attachments", tags=["Files"])
ENTITIES = {"student": Student, "lead": Lead, "expense": Expense, "employee": Employee}
ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".pdf", ".doc", ".docx", ".xls", ".xlsx"}
UPLOAD_ROOT = Path(settings.UPLOAD_DIR)


async def _entity_access(db, user, entity_type: str, entity_id: int):
    model = ENTITIES.get(entity_type)
    if model is None:
        raise HTTPException(400, f"entity_type quyidagilardan biri bo'lishi kerak: {sorted(ENTITIES)}")
    obj = await check_ident(db, model, entity_id, "Obyekt topilmadi")
    if not has_role(user, ADMIN, MANAGER, ACCOUNTANT):
        raise HTTPException(403, "Ruxsat yo'q")
    ensure_branch(user, obj.branch_id)


@router.post("/", response_model=AttachmentResponse, status_code=201)
async def upload(db: MyDb, user: AuthUser, entity_type: str = Form(...), entity_id: int = Form(...),
                 file: UploadFile = File(...)):
    await _entity_access(db, user, entity_type, entity_id)
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(400, f"Ruxsat etilgan fayl turlari: {sorted(ALLOWED_EXT)}")
    UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
    stored = f"{uuid.uuid4().hex}{ext}"  # foydalanuvchi bergan nom yo'lga qo'yilmaydi (path traversal yo'q)
    path = UPLOAD_ROOT / stored
    limit, size = settings.MAX_UPLOAD_MB * 1024 * 1024, 0
    try:
        with open(path, "wb") as out:
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                if size > limit:
                    raise HTTPException(413, f"Fayl {settings.MAX_UPLOAD_MB} MB dan katta")
                out.write(chunk)
    except HTTPException:
        path.unlink(missing_ok=True)
        raise
    obj = Attachment(entity_type=entity_type, entity_id=entity_id, file_url=stored,
                     file_name=(file.filename or stored)[:255], uploaded_by=user.id)
    db.add(obj)
    await safe_commit(db)
    return obj


@router.get("/", response_model=list[AttachmentResponse])
async def list_files(entity_type: str, entity_id: int, db: MyDb, user: AuthUser):
    await _entity_access(db, user, entity_type, entity_id)
    return (await db.execute(select(Attachment).where(Attachment.entity_type == entity_type,
                                                      Attachment.entity_id == entity_id)
                             .order_by(Attachment.id.desc()))).scalars().all()


@router.get("/{attachment_id}/download")
async def download(attachment_id: int, db: MyDb, user: AuthUser):
    a = await check_ident(db, Attachment, attachment_id, "Fayl topilmadi")
    await _entity_access(db, user, a.entity_type, a.entity_id)
    path = UPLOAD_ROOT / a.file_url
    if not path.is_file():
        raise HTTPException(404, "Fayl diskda topilmadi")
    return FileResponse(path, filename=a.file_name)


@router.delete("/{attachment_id}", response_model=Message)
async def delete_file(attachment_id: int, db: MyDb, user: AuthUser):
    a = await check_ident(db, Attachment, attachment_id, "Fayl topilmadi")
    await _entity_access(db, user, a.entity_type, a.entity_id)
    if a.uploaded_by != user.id and not is_admin(user):
        raise HTTPException(403, "Faylni faqat yuklagan xodim yoki admin o'chira oladi")
    (UPLOAD_ROOT / a.file_url).unlink(missing_ok=True)
    await db.delete(a)
    await safe_commit(db)
    return Message(msg="Fayl o'chirildi")
