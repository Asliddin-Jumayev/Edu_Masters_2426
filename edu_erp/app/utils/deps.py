from typing import Annotated
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database.connection import get_db

MyDb = Annotated[AsyncSession, Depends(get_db)]
