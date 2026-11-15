import type { Me } from '@/api/types'

export type RoleCode = 'admin' | 'manager' | 'teacher' | 'accountant'

export const roleCodes = (me?: Me): Set<string> => new Set(me?.roles.map((r) => r.code) ?? [])

/** admin hamma narsaga ruxsat (backend dagi require_roles bilan bir xil) */
export function hasRole(me: Me | undefined, ...codes: RoleCode[]): boolean {
  const r = roleCodes(me)
  return r.has('admin') || codes.some((c) => r.has(c))
}

export const isTeacherOnly = (me?: Me) => {
  const r = roleCodes(me)
  return r.has('teacher') && !['admin', 'manager', 'accountant'].some((c) => r.has(c))
}

// Backend ruxsat turlariga mos shorthandlar
export const can = {
  manager: (me?: Me) => hasRole(me, 'manager'),                  // manager + admin
  finance: (me?: Me) => hasRole(me, 'manager', 'accountant'),
  accountant: (me?: Me) => hasRole(me, 'accountant'),            // accountant + admin
  admin: (me?: Me) => hasRole(me),                               // faqat admin
  academic: (me?: Me) => hasRole(me, 'manager', 'teacher'),
}
