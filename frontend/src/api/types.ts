import type { components } from './schema'

type S = components['schemas']

export type Me = S['MeResponse']
export type Branch = S['BranchResponse']
export type Room = S['RoomResponse']
export type Role = S['RoleResponse']
export type Employee = S['EmployeeResponse']
export type EmployeeRole = S['EmployeeRoleResponse']
export type TeacherProfile = S['TeacherProfileResponse']
export type Course = S['CourseResponse']
export type Group = S['GroupResponse']
export type Schedule = S['ScheduleResponse']
export type Student = S['StudentResponse']
export type Enrollment = S['EnrollmentResponse']
export type BalanceTxn = S['BalanceTxnResponse']
export type Session = S['SessionResponse']
export type Attendance = S['AttendanceResponse']
export type Exam = S['ExamResponse']
export type ExamResult = S['ResultResponse']
export type Certificate = S['CertificateResponse']
export type CertificateVerify = S['CertificateVerify']
export type Lead = S['LeadResponse']
export type LeadStatus = S['LeadStatusResponse']
export type LeadSource = S['LeadSourceResponse']
export type LeadActivity = S['ActivityResponse']
export type Task = S['TaskResponse']
export type Trial = S['TrialResponse']
export type Invoice = S['InvoiceResponse']
export type Payment = S['PaymentResponse']
export type PaymentMethod = S['PaymentMethodResponse']
export type Discount = S['DiscountResponse']
export type Expense = S['ExpenseResponse']
export type ExpenseCategory = S['ExpenseCategoryResponse']
export type SalaryRule = S['SalaryRuleResponse']
export type Payroll = S['PayrollResponse']
export type SmsTemplate = S['SmsTemplateResponse']
export type Sms = S['SmsResponse']
export type Notification = S['NotificationResponse']
export type Attachment = S['AttachmentResponse']
export type AuditLog = S['AuditLogResponse']
export type Device = S['DeviceResponse']
export type ProviderTx = S['ProviderTxResponse']
export type Checkout = S['OnlineCheckoutResponse']
export type Integrations = S['IntegrationsStatus']
export type TestResult = S['TestResult']

export interface Page<T> { items: T[]; total: number; limit: number; offset: number }

export interface Dashboard {
  period: { from: string; to: string }
  students_active: number
  groups_active: number
  leads_this_month: number
  leads_won_this_month: number
  lead_conversion_percent: number
  income_this_month: string | number
  expenses_this_month: string | number
  profit_this_month: string | number
  debtors_count: number
  debt_total: string | number
  sessions_today: number
}
export interface Debtor { student_id: number; name: string; phone: string | null; parent_phone: string | null; debt: string | number; branch_id: number }
export interface FunnelStage { status_id: number; name: string; is_won: boolean; is_lost: boolean; count: number }
export interface LeadSourceStat { source_id: number; name: string; leads: number; won: number; monthly_budget: string | number; cost_per_lead: number | null; cost_per_student: number | null }
export interface IncomeExpense { period: { from: string; to: string }; income: string | number; expenses: string | number; profit: string | number; expenses_by_category: { category: string; total: string | number }[] }
