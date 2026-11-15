import enum
from sqlalchemy import Enum as SAEnum


class _Str(str, enum.Enum):
    def __str__(self):
        return self.value


def db_enum(cls) -> SAEnum:
    """Bazaga enum NOMI emas, QIYMATI yoziladi (planned, active, ...)."""
    return SAEnum(cls, name=cls.__name__.lower(), values_callable=lambda e: [m.value for m in e])


class GroupStatus(_Str):
    PLANNED = "planned"; ACTIVE = "active"; COMPLETED = "completed"; CANCELLED = "cancelled"

class StudentStatus(_Str):
    TRIAL = "trial"; ACTIVE = "active"; FROZEN = "frozen"; GRADUATED = "graduated"; LEFT = "left"

class EnrollmentStatus(_Str):
    ACTIVE = "active"; FROZEN = "frozen"; COMPLETED = "completed"; DROPPED = "dropped"

class SessionStatus(_Str):
    PLANNED = "planned"; HELD = "held"; CANCELLED = "cancelled"

class AttendanceStatus(_Str):
    PRESENT = "present"; ABSENT = "absent"; LATE = "late"; EXCUSED = "excused"

class ExamType(_Str):
    QUIZ = "quiz"; MIDTERM = "midterm"; FINAL = "final"

class InvoiceStatus(_Str):
    UNPAID = "unpaid"; PARTIAL = "partial"; PAID = "paid"; OVERDUE = "overdue"; CANCELLED = "cancelled"

class PaymentStatus(_Str):
    PENDING = "pending"; COMPLETED = "completed"; FAILED = "failed"

class DiscountType(_Str):
    PERCENT = "percent"; FIXED = "fixed"

class BalanceTxnType(_Str):
    CHARGE = "charge"; PAYMENT = "payment"; REFUND = "refund"; ADJUSTMENT = "adjustment"

class SalaryType(_Str):
    FIXED = "fixed"; PERCENT = "percent"; PER_LESSON = "per_lesson"; HOURLY = "hourly"

class PayrollStatus(_Str):
    DRAFT = "draft"; APPROVED = "approved"; PAID = "paid"

class SmsStatus(_Str):
    QUEUED = "queued"; SENT = "sent"; DELIVERED = "delivered"; FAILED = "failed"

class ActivityType(_Str):
    CALL = "call"; SMS = "sms"; TELEGRAM = "telegram"; MEETING = "meeting"; NOTE = "note"

class TaskPriority(_Str):
    LOW = "low"; MEDIUM = "medium"; HIGH = "high"
