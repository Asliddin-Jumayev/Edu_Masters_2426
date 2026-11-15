"""Tayyor ruxsat turlari. Routerlarda:  user: ManagerUser"""
from typing import Annotated
from fastapi import Depends
from app.models.employees import Employee
from app.utils.roles import ADMIN, MANAGER, TEACHER, ACCOUNTANT
from app.utils.security import get_current_user, require_roles

AuthUser = Annotated[Employee, Depends(get_current_user)]                       # har qanday kirgan xodim
AdminUser = Annotated[Employee, Depends(require_roles([ADMIN]))]
ManagerUser = Annotated[Employee, Depends(require_roles([MANAGER]))]            # manager + admin
FinanceUser = Annotated[Employee, Depends(require_roles([MANAGER, ACCOUNTANT]))]
AccountantUser = Annotated[Employee, Depends(require_roles([ACCOUNTANT]))]     # accountant + admin
AcademicUser = Annotated[Employee, Depends(require_roles([MANAGER, TEACHER]))]
