from datetime import datetime, timezone, date, timedelta


def utcnow() -> datetime:
    """Naive UTC datetime. Bazada hamma vaqt UTC da saqlanadi."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def today() -> date:
    return utcnow().date()


def month_start(d: date) -> date:
    return d.replace(day=1)


def month_end(d: date) -> date:
    return (d.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
