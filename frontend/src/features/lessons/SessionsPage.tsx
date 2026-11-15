import { useMemo, useState } from 'react'
import { ClipboardCheck } from 'lucide-react'
import type { Employee, Group, Session } from '@/api/types'
import { ResourcePage } from '@/components/resource'
import { Button, StatusBadge } from '@/components/ui'
import { useAuth } from '@/lib/auth'
import { useNames } from '@/lib/hooks'
import { O_SESSION_STATUS, SESSION_STATUS, WEEKDAY_SHORT } from '@/lib/labels'
import { can } from '@/lib/permissions'
import { fmtDate, fmtTime, fullName } from '@/lib/utils'
import { addDays, format, startOfWeek } from 'date-fns'
import { AttendanceDialog } from './AttendanceDialog'

export default function SessionsPage() {
  const me = useAuth((s) => s.me)
  const [att, setAtt] = useState<Session | null>(null)
  const group = useNames<Group>('/groups/', (g) => g.name)
  const teacher = useNames<Employee>(can.finance(me) ? '/employees/' : null, (e) => fullName(e), { role: 'teacher' })
  const week = useMemo(() => {
    const s = startOfWeek(new Date(), { weekStartsOn: 1 })
    return { date_from: format(s, 'yyyy-MM-dd'), date_to: format(addDays(s, 6), 'yyyy-MM-dd') }
  }, [])
  return (
    <>
      <ResourcePage<Session>
        title="Darslar va davomat" subtitle="Dars jadvali. ‘Davomat’ tugmasi o‘quvchilarni belgilash oynasini ochadi." endpoint="/lesson-sessions/" noun="dars"
        defaultFilters={week} pageSize={50} modalSize="lg"
        canCreate={can.manager} canEdit={can.manager} canDelete={can.manager} deleteHint="O‘tilgan (davomat belgilangan) darsni o‘chirib bo‘lmaydi."
        filters={[
          { name: 'date_from', label: 'Dan', type: 'date' }, { name: 'date_to', label: 'Gacha', type: 'date' },
          { name: 'group_id', label: 'Guruh', type: 'select', emptyLabel: 'Barcha guruhlar', options: { endpoint: '/groups/', label: (g: Group) => g.name } },
          { name: 'status', label: 'Holat', type: 'select', emptyLabel: 'Barcha holatlar', options: O_SESSION_STATUS },
        ]}
        columns={[
          { key: 'd', header: 'Sana', cell: (s) => <span className="num font-medium">{fmtDate(s.date)} <span className="font-normal text-muted">{WEEKDAY_SHORT[new Date(s.date + 'T00:00').getDay() || 7]}</span></span> },
          { key: 't', header: 'Vaqt', cell: (s) => <span className="num">{fmtTime(s.start_time)}–{fmtTime(s.end_time)}</span> },
          { key: 'g', header: 'Guruh', cell: (s) => group(s.group_id) },
          { key: 'u', header: 'O‘qituvchi', cell: (s) => (s.teacher_id ? teacher(s.teacher_id) : '—') },
          { key: 'm', header: 'Mavzu', cell: (s) => s.topic ?? <span className="text-muted">—</span> },
          { key: 's', header: 'Holat', cell: (s) => <StatusBadge map={SESSION_STATUS} value={s.status} /> },
        ]}
        rowActions={(s) => s.status !== 'cancelled' ? <Button size="sm" onClick={() => setAtt(s)}><ClipboardCheck className="size-4" />Davomat</Button> : null}
        fields={[
          { name: 'group_id', label: 'Guruh', type: 'select', required: true, createOnly: true, span: 2, options: { endpoint: '/groups/', params: { status: 'active' }, label: (g: Group) => g.name } },
          { name: 'date', label: 'Sana', type: 'date', required: true }, { name: 'status', label: 'Holat', type: 'select', editOnly: true, options: O_SESSION_STATUS },
          { name: 'start_time', label: 'Boshlanishi', type: 'time', required: true }, { name: 'end_time', label: 'Tugashi', type: 'time', required: true },
          { name: 'topic', label: 'Mavzu', clearable: true, span: 2 }, { name: 'note', label: 'Izoh', type: 'textarea', clearable: true, span: 2 },
        ]}
      />
      <AttendanceDialog session={att} groupName={att ? group(att.group_id) : ''} onClose={() => setAtt(null)} />
    </>
  )
}
