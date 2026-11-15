export type Tone = 'neutral' | 'brand' | 'success' | 'warn' | 'danger' | 'info'
export type LabelMap = Record<string, { label: string; tone: Tone }>

export const STUDENT_STATUS: LabelMap = {
  trial: { label: 'Sinov', tone: 'info' }, active: { label: 'Faol', tone: 'success' },
  frozen: { label: 'Muzlatilgan', tone: 'warn' }, graduated: { label: 'Bitirgan', tone: 'brand' },
  left: { label: 'Ketgan', tone: 'neutral' },
}
export const GROUP_STATUS: LabelMap = {
  planned: { label: 'Rejada', tone: 'info' }, active: { label: 'Faol', tone: 'success' },
  completed: { label: 'Yakunlangan', tone: 'brand' }, cancelled: { label: 'Bekor', tone: 'neutral' },
}
export const ENROLLMENT_STATUS: LabelMap = {
  active: { label: 'Faol', tone: 'success' }, frozen: { label: 'Muzlatilgan', tone: 'warn' },
  completed: { label: 'Tugatgan', tone: 'brand' }, dropped: { label: 'Chiqib ketgan', tone: 'neutral' },
}
export const SESSION_STATUS: LabelMap = {
  planned: { label: 'Rejada', tone: 'info' }, held: { label: "O'tkazildi", tone: 'success' },
  cancelled: { label: 'Bekor', tone: 'neutral' },
}
export const ATTENDANCE_STATUS: LabelMap = {
  present: { label: 'Keldi', tone: 'success' }, absent: { label: 'Kelmadi', tone: 'danger' },
  late: { label: 'Kechikdi', tone: 'warn' }, excused: { label: 'Sababli', tone: 'info' },
}
export const INVOICE_STATUS: LabelMap = {
  unpaid: { label: "To'lanmagan", tone: 'warn' }, partial: { label: 'Qisman', tone: 'info' },
  paid: { label: "To'langan", tone: 'success' }, overdue: { label: "Muddati o'tgan", tone: 'danger' },
  cancelled: { label: 'Bekor', tone: 'neutral' },
}
export const PAYMENT_STATUS: LabelMap = {
  pending: { label: 'Kutilmoqda', tone: 'warn' }, completed: { label: 'Muvaffaqiyatli', tone: 'success' },
  failed: { label: 'Xato', tone: 'danger' },
}
export const PAYROLL_STATUS: LabelMap = {
  draft: { label: 'Qoralama', tone: 'neutral' }, approved: { label: 'Tasdiqlangan', tone: 'info' },
  paid: { label: "To'langan", tone: 'success' },
}
export const SMS_STATUS: LabelMap = {
  queued: { label: 'Navbatda', tone: 'neutral' }, sent: { label: 'Yuborildi', tone: 'info' },
  delivered: { label: 'Yetkazildi', tone: 'success' }, failed: { label: 'Xato', tone: 'danger' },
}
export const PRIORITY: LabelMap = {
  low: { label: 'Past', tone: 'neutral' }, medium: { label: "O'rta", tone: 'info' }, high: { label: 'Yuqori', tone: 'danger' },
}

export type Opt = { value: string | number; label: string }
const opts = (m: Record<string, string>): Opt[] => Object.entries(m).map(([value, label]) => ({ value, label }))

export const WEEKDAYS: Opt[] = [
  { value: 1, label: 'Dushanba' }, { value: 2, label: 'Seshanba' }, { value: 3, label: 'Chorshanba' },
  { value: 4, label: 'Payshanba' }, { value: 5, label: 'Juma' }, { value: 6, label: 'Shanba' }, { value: 7, label: 'Yakshanba' },
]
export const WEEKDAY_SHORT = ['', 'Du', 'Se', 'Chor', 'Pay', 'Ju', 'Sha', 'Yak']

export const O_STUDENT_STATUS = opts(Object.fromEntries(Object.entries(STUDENT_STATUS).map(([k, v]) => [k, v.label])))
export const O_GROUP_STATUS = opts(Object.fromEntries(Object.entries(GROUP_STATUS).map(([k, v]) => [k, v.label])))
export const O_INVOICE_STATUS = opts(Object.fromEntries(Object.entries(INVOICE_STATUS).map(([k, v]) => [k, v.label])))
export const O_SESSION_STATUS = opts(Object.fromEntries(Object.entries(SESSION_STATUS).map(([k, v]) => [k, v.label])))
export const O_PRIORITY = opts(Object.fromEntries(Object.entries(PRIORITY).map(([k, v]) => [k, v.label])))
export const O_ACTIVITY = opts({ call: "Qo'ng'iroq", sms: 'SMS', telegram: 'Telegram', meeting: 'Uchrashuv', note: 'Eslatma' })
export const O_EXAM_TYPE = opts({ quiz: 'Quiz', midterm: "Oraliq", final: 'Yakuniy' })
export const O_DISCOUNT_TYPE = opts({ percent: 'Foiz (%)', fixed: "Qat'iy summa" })
export const O_SALARY_TYPE = opts({ fixed: 'Oylik (qat\'iy)', percent: 'Tushumdan foiz', per_lesson: 'Dars uchun', hourly: 'Soatbay' })
export const ACTIVITY_LABEL: Record<string, string> = { call: "Qo'ng'iroq", sms: 'SMS', telegram: 'Telegram', meeting: 'Uchrashuv', note: 'Eslatma' }
export const SALARY_LABEL: Record<string, string> = { fixed: "Qat'iy oylik", percent: 'Tushumdan foiz', per_lesson: 'Dars uchun', hourly: 'Soatbay' }
export const TXN_LABEL: Record<string, string> = { charge: 'Hisob yozildi', payment: "To'lov", refund: 'Qaytarish', adjustment: 'Tuzatish' }
export const ROLE_LABEL: Record<string, string> = { admin: 'Administrator', manager: 'Menejer', teacher: "O'qituvchi", accountant: 'Buxgalter' }
