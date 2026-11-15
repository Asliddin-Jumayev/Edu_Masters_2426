from fastapi import APIRouter, HTTPException
from sqlalchemy import select
from app.models.branches import Branch
from app.models.enums import GroupStatus
from app.models.groups import Group
from app.models.rooms import Room
from app.schemes.common import Message
from app.schemes.rooms import RoomCreate, RoomResponse, RoomUpdate
from app.utils.access import ensure_branch, scoped
from app.utils.checked import check_ident, safe_commit
from app.utils.deps import MyDb
from app.utils.permissions import AuthUser, ManagerUser

router = APIRouter(prefix="/rooms", tags=["Rooms"])
_LIVE = [GroupStatus.PLANNED, GroupStatus.ACTIVE]


@router.post("/", response_model=RoomResponse, status_code=201)
async def create_room(data: RoomCreate, db: MyDb, user: ManagerUser):
    ensure_branch(user, data.branch_id)
    await check_ident(db, Branch, data.branch_id, "Filial topilmadi")
    obj = Room(**data.model_dump())
    db.add(obj)
    await safe_commit(db)
    return obj


@router.get("/", response_model=list[RoomResponse])
async def list_rooms(db: MyDb, user: AuthUser, branch_id: int | None = None, is_active: bool | None = True):
    stmt = scoped(select(Room), Room.branch_id, user).order_by(Room.branch_id, Room.name)
    if branch_id is not None:
        stmt = stmt.where(Room.branch_id == branch_id)
    if is_active is not None:
        stmt = stmt.where(Room.is_active == is_active)
    return (await db.execute(stmt)).scalars().all()


@router.get("/{room_id}", response_model=RoomResponse)
async def get_room(room_id: int, db: MyDb, user: AuthUser):
    room = await check_ident(db, Room, room_id, "Xona topilmadi")
    ensure_branch(user, room.branch_id)
    return room


@router.put("/{room_id}", response_model=RoomResponse)
async def update_room(room_id: int, data: RoomUpdate, db: MyDb, user: ManagerUser):
    room = await check_ident(db, Room, room_id, "Xona topilmadi")
    ensure_branch(user, room.branch_id)
    changes = data.model_dump(exclude_unset=True)
    new_cap = changes.get("capacity")
    if new_cap is not None and new_cap < room.capacity:
        too_big = await db.scalar(select(Group.id).where(
            Group.room_id == room.id, Group.status.in_(_LIVE), Group.max_students > new_cap).limit(1))
        if too_big:
            raise HTTPException(409, "Bu xonadagi guruhlarning max_students qiymati yangi sig'imdan katta")
    if changes.get("is_active") is False:
        await _ensure_not_used(db, room.id)
    for k, v in changes.items():
        setattr(room, k, v)
    await safe_commit(db)
    return room


async def _ensure_not_used(db, room_id: int):
    if await db.scalar(select(Group.id).where(Group.room_id == room_id, Group.status.in_(_LIVE)).limit(1)):
        raise HTTPException(409, "Xona faol/rejalashtirilgan guruhda ishlatilmoqda")


@router.delete("/{room_id}", response_model=Message)
async def deactivate_room(room_id: int, db: MyDb, user: ManagerUser):
    room = await check_ident(db, Room, room_id, "Xona topilmadi")
    ensure_branch(user, room.branch_id)
    await _ensure_not_used(db, room.id)
    room.is_active = False
    await safe_commit(db)
    return Message(msg="Xona faolsizlantirildi")
