"""WebSocket endpointi — real-time bildirishnomalar (in-memory va Redis Pub/Sub production).

Foydalanuvchilar o'z bildirishnomalarini WebSocket orqali real-time oladi.
Autentifikatsiya: JWT token so'rov parametri sifatida uzatiladi (?token=...).

Multi-instance / Production qo'llab-quvvatlashi:
  - Redis mavjud bo'lsa: Redis Pub/Sub kanali orqali barcha instancelar o'rtasida sinxronlanadi.
  - Redis yo'q bo'lsa: In-memory mahalliy ulanishlar orqali ishlaydi (fallback).
"""
import asyncio
import json
import logging
from collections import defaultdict
from typing import Any, DefaultDict

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.utils.config import settings
from app.utils.security import decode_token

log = logging.getLogger("ws")

router = APIRouter(tags=["WebSocket"])

REDIS_CHANNEL = "erp:ws_notifications"


class ConnectionManager:
    """WebSocket connection menejeri (In-Memory + Redis Pub/Sub Production)."""

    def __init__(self):
        self._connections: DefaultDict[int, list[WebSocket]] = defaultdict(list)
        self._redis: Any = None
        self._sub_task: asyncio.Task | None = None

    async def init_redis_pubsub(self, redis_url: str) -> None:
        """Production uchun Redis Pub/Sub obunasini yoqadi."""
        if not redis_url:
            return
        try:
            import redis.asyncio as aioredis
            self._redis = aioredis.from_url(redis_url, encoding="utf-8", decode_responses=True)
            self._sub_task = asyncio.create_task(self._listen_redis())
            log.info("WebSocket Redis Pub/Sub yoqildi (kanal: %s)", REDIS_CHANNEL)
        except Exception as e:
            log.warning("WebSocket Redis Pub/Sub ulanmadi (%s), faqat in-memory ishlaydi", e)

    async def _listen_redis(self) -> None:
        """Redis kanalini tinglab, kelgan xabarni mahalliy WS langan foydalanuvchilarga tarqatadi."""
        try:
            pubsub = self._redis.pubsub()
            await pubsub.subscribe(REDIS_CHANNEL)
            async for message in pubsub.listen():
                if message and message["type"] == "message":
                    payload = json.loads(message["data"])
                    target_user = payload.get("user_id")
                    data = payload.get("data")
                    if target_user is not None:
                        await self._local_send(int(target_user), data)
                    else:
                        await self._local_broadcast(data)
        except asyncio.CancelledError:
            log.info("Redis Pub/Sub tinglash to'xtatildi")
        except Exception as e:
            log.error("Redis Pub/Sub tinglovchi xatosi: %s", e)

    async def connect(self, ws: WebSocket, user_id: int) -> None:
        await ws.accept()
        self._connections[user_id].append(ws)
        log.debug("WS connect: user_id=%d, jami=%d ulanish", user_id, len(self._connections[user_id]))

    def disconnect(self, ws: WebSocket, user_id: int) -> None:
        conns = self._connections.get(user_id, [])
        if ws in conns:
            conns.remove(ws)
        if not conns:
            self._connections.pop(user_id, None)
        log.debug("WS disconnect: user_id=%d", user_id)

    async def _local_send(self, user_id: int, data: dict) -> None:
        dead = []
        for ws in list(self._connections.get(user_id, [])):
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws, user_id)

    async def _local_broadcast(self, data: dict) -> None:
        tasks = [self._local_send(uid, data) for uid in list(self._connections.keys())]
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def send(self, user_id: int, data: dict) -> None:
        """Foydalanuvchiga xabar yuborish (Redis Pub/Sub yoki mahalliy)."""
        if self._redis is not None:
            try:
                payload = json.dumps({"user_id": user_id, "data": data}, default=str)
                await self._redis.publish(REDIS_CHANNEL, payload)
                return
            except Exception as e:
                log.warning("Redis publish xatosi (%s), mahalliy yuborilmoqda", e)
        await self._local_send(user_id, data)

    async def broadcast(self, data: dict) -> None:
        """Barcha serverlardagi barcha foydalanuvchilarga xabar yuborish."""
        if self._redis is not None:
            try:
                payload = json.dumps({"user_id": None, "data": data}, default=str)
                await self._redis.publish(REDIS_CHANNEL, payload)
                return
            except Exception as e:
                log.warning("Redis broadcast xatosi (%s), mahalliy yuborilmoqda", e)
        await self._local_broadcast(data)

    async def close(self) -> None:
        if self._sub_task:
            self._sub_task.cancel()
        if self._redis:
            await self._redis.close()

    @property
    def connected_user_ids(self) -> list[int]:
        return list(self._connections.keys())


# Global manager (barcha ulanishlar uchun bitta instance)
manager = ConnectionManager()


@router.websocket("/ws/notifications")
async def ws_notifications(
    websocket: WebSocket,
    token: str = Query(..., description="JWT access token"),
):
    """Real-time bildirishnomalar WebSocket endpointi."""
    try:
        user_id = decode_token(token, "access")
    except Exception:
        await websocket.close(code=4001, reason="Token yaroqsiz")
        return

    await manager.connect(websocket, user_id)
    await websocket.send_json({
        "type": "connected",
        "message": f"WebSocket ulanishi o'rnatildi (user_id={user_id})",
    })

    try:
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_json(), timeout=30)
                if isinstance(data, dict) and data.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
            except asyncio.TimeoutError:
                await websocket.send_json({"type": "heartbeat"})
    except WebSocketDisconnect:
        log.info("WS uzildi: user_id=%d", user_id)
    except Exception as e:
        log.warning("WS xatosi (user_id=%d): %s", user_id, e)
    finally:
        manager.disconnect(websocket, user_id)


@router.get("/ws/status", tags=["WebSocket"])
async def ws_status():
    """Hozirda ulangan foydalanuvchilar soni (monitoring)."""
    return {
        "connected_users": len(manager.connected_user_ids),
        "user_ids": manager.connected_user_ids,
        "mode": "redis_pubsub" if manager._redis else "in_memory",
    }
