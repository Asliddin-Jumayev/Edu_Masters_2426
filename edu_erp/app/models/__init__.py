"""Hamma modellarni import qiladi — mapper va Alembic autogenerate uchun SHART."""
from app.models.enums import *  # noqa: F401,F403
from app.models.branches import Branch  # noqa: F401
from app.models.rooms import Room  # noqa: F401
from app.models.roles import Role  # noqa: F401
from app.models.employees import Employee  # noqa: F401
from app.models.employee_roles import EmployeeRole  # noqa: F401
from app.models.teacher_profiles import TeacherProfile  # noqa: F401
from app.models.courses import Course  # noqa: F401
from app.models.groups import Group  # noqa: F401
from app.models.students import Student, Enrollment  # noqa: F401
from app.models.lessons import GroupSchedule, LessonSession, Attendance  # noqa: F401
from app.models.exams import Exam, ExamResult, Certificate  # noqa: F401
from app.models.crm import LeadSource, LeadStatus, Lead, LeadActivity, Task, TrialLesson  # noqa: F401
from app.models.finance import (PaymentMethod, Invoice, Payment, Discount,  # noqa: F401
                                StudentBalanceTransaction, ExpenseCategory, Expense)
from app.models.payroll import SalaryRule, Payroll  # noqa: F401
from app.models.communication import SmsTemplate, SmsLog, Notification  # noqa: F401
from app.models.system import AuditLog, Attachment, LoginDevice  # noqa: F401
from app.models.online import ProviderTransaction  # noqa: F401
