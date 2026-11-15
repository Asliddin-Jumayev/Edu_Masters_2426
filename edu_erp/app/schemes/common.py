import datetime as dt
import re
from decimal import Decimal
from typing import Annotated
from pydantic import AfterValidator, BaseModel, ConfigDict, Field


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Message(BaseModel):
    msg: str


def normalize_phone(v: str) -> str:
    digits = re.sub(r"\D", "", v or "")
    if len(digits) == 9:
        digits = "998" + digits
    if not (len(digits) == 12 and digits.startswith("998")):
        raise ValueError("Telefon raqami noto'g'ri. Format: +998901234567")
    return "+" + digits


Phone = Annotated[str, AfterValidator(normalize_phone)]
Money = Annotated[Decimal, Field(ge=0, max_digits=14, decimal_places=2)]
PositiveMoney = Annotated[Decimal, Field(gt=0, max_digits=14, decimal_places=2)]


def first_of_month(v: dt.date) -> dt.date:
    return v.replace(day=1)


MonthStart = Annotated[dt.date, AfterValidator(first_of_month)]
