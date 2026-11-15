import datetime as dt
from decimal import Decimal
from pydantic import BaseModel, Field, model_validator
from app.models.enums import ExamType
from app.schemes.common import ORM


class ExamCreate(BaseModel):
    group_id: int
    title: str = Field(min_length=1, max_length=160)
    type: ExamType = ExamType.QUIZ
    max_score: int = Field(gt=0, le=1000)
    passing_score: int = Field(ge=0, le=1000)
    held_at: dt.datetime | None = None

    @model_validator(mode="after")
    def _passing(self):
        if self.passing_score > self.max_score:
            raise ValueError("passing_score max_score dan oshmasligi kerak")
        return self


class ExamUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=160)
    type: ExamType | None = None
    max_score: int | None = Field(None, gt=0, le=1000)
    passing_score: int | None = Field(None, ge=0, le=1000)
    held_at: dt.datetime | None = None


class ExamResponse(ORM):
    id: int
    group_id: int
    title: str
    type: ExamType
    max_score: int
    passing_score: int
    held_at: dt.datetime | None
    created_by: int | None


class ResultItem(BaseModel):
    student_id: int
    score: Decimal = Field(ge=0, max_digits=5, decimal_places=2)


class ResultsBulk(BaseModel):
    results: list[ResultItem] = Field(min_length=1)


class ResultResponse(ORM):
    id: int
    exam_id: int
    student_id: int
    score: Decimal
    graded_by: int | None
    graded_at: dt.datetime
    first_name: str | None = None
    last_name: str | None = None
    passed: bool | None = None


class CertificateIssue(BaseModel):
    student_id: int
    group_id: int
    file_url: str | None = None
    force: bool = False  # faqat admin: shartlarni e'tiborsiz qoldirish


class CertificateResponse(ORM):
    id: int
    student_id: int
    group_id: int
    serial_number: str
    file_url: str | None
    issued_at: dt.date
    issued_by: int | None


class CertificateVerify(BaseModel):
    valid: bool
    serial_number: str
    student_name: str | None = None
    course_name: str | None = None
    issued_at: dt.date | None = None
