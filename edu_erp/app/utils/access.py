"""Rol va filial doirasi (scope) yordamchilari.

employee_roles.branch_id: NULL = barcha filiallarda, aks holda faqat shu filialda.
"""
from fastapi import HTTPException
from app.utils.roles import ADMIN, MANAGER, ACCOUNTANT, TEACHER


def role_codes(user) -> set[str]:
    return {er.role.code for er in user.employee_roles if er.role is not None}


def has_role(user, *codes: str) -> bool:
    return bool(role_codes(user) & set(codes))


def is_admin(user) -> bool:
    return ADMIN in role_codes(user)


def is_teacher_only(user) -> bool:
    codes = role_codes(user)
    return TEACHER in codes and not (codes & {ADMIN, MANAGER, ACCOUNTANT})


def branch_scope(user) -> set[int] | None:
    """None = hamma filial; aks holda ruxsat etilgan filial id lari."""
    if is_admin(user) or any(er.branch_id is None for er in user.employee_roles):
        return None
    return {er.branch_id for er in user.employee_roles}


def ensure_branch(user, branch_id: int | None):
    scope = branch_scope(user)
    if scope is not None and branch_id not in scope:
        raise HTTPException(403, "Bu filial ma'lumotlariga ruxsatingiz yo'q")


def scoped(stmt, column, user):
    scope = branch_scope(user)
    if scope is not None:
        stmt = stmt.where(column.in_(scope or {-1}))
    return stmt


def branch_ids_for(user, requested: int | None) -> list[int] | None:
    """Hisobotlar uchun: so'ralgan filial yoki foydalanuvchi doirasi. None = cheklov yo'q."""
    if requested is not None:
        ensure_branch(user, requested)
        return [requested]
    scope = branch_scope(user)
    return None if scope is None else (list(scope) or [-1])
