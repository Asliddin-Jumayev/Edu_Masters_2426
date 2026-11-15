import { useEffect, useState } from 'react'
import { api } from '@/api/client'
import { useGet, useMut } from '@/api/hooks'
import type { Attendance, Session, Student } from '@/api/types'
import { Button, Field, Input, Modal, Segmented, Spinner, StatusBadge } from '@/components/ui'
import { useAuth } from '@/lib/auth'
import { ATTENDANCE_STATUS, SESSION_STATUS } from '@/lib/labels'
import { fmtDate, fmtTime, fullName } from '@/lib/utils'

type St = 'present' | 'absent' | 'late' | 'excused'
const OPTS: { value: St; label: string }[] = [
  { value: 'present', label: 'Keldi' }, { value: 'late', label: 'Kechikdi' }, { value: 'excused', label: 'Sababli' }, { value: 'absent', label: 'Kelmadi' },
]
const TONES: Record<St, string> = {
  present: 'bg-success-soft text-success font-semibold', late: 'bg-warn-soft text-warn font-semibold',
  excused: 'bg-brand-soft text-brand font-semibold', absent: 'bg-danger-soft text-danger font-semibold',
}

export function AttendanceDialog({ session, groupName, onClose }: { session: Session | null; groupName?: string; onClose: () => void }) {
  const me = useAuth((s) => s.me)
  const students = useGet<Student[]>(session ? `/groups/${session.group_id}/students` : null)
  const existing = useGet<Attendance[]>(session ? `/lesson-sessions/${session.id}/attendance` : null)
  const [marks, setMarks] = useState<Record<number, { status: St; note: string }>>({})
  const [topic, setTopic] = useState('')
  const ready = !!students.data && !!existing.data

  useEffect(() => {
    if (!session || !students.data || !existing.data) return
    const ex = new Map(existing.data.map((a) => [a.student_id, a]))
    const next: Record<number, { status: St; note: string }> = {}
    for (const s of students.data) {
      const a = ex.get(s.id)
      next[s.id] = { status: (a?.status as St) ?? 'present', note: a?.note ?? '' }
    }
    setMarks(next); setTopic(session.topic ?? '')
  }, [session, students.data, existing.data])

  const save = useMut(async () => {
    if (!session) return
    if (topic !== (session.topic ?? '')) await api.put(`/lesson-sessions/${session.id}`, { topic })
    await api.put(`/lesson-sessions/${session.id}/attendance`, { items: Object.entries(marks).map(([id, m]) => ({ student_id: Number(id), status: m.status, note: m.note || null })) })
  }, { invalidate: ['/lesson-sessions/', '/attendances/'], success: 'Davomat saqlandi', onSuccess: onClose })

  const setAll = (status: St) => setMarks((p) => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, { ...v, status }])))
  const list = students.data ?? []
  const absent = Object.values(marks).filter((m) => m.status === 'absent').length
  const cancelled = session?.status === 'cancelled'
  return (
    <Modal open={!!session} onClose={onClose} size="lg" title={`Davomat: ${groupName ?? ''}`}
      description={session && <span className="flex flex-wrap items-center gap-2">{fmtDate(session.date)} · {fmtTime(session.start_time)}–{fmtTime(session.end_time)} <StatusBadge map={SESSION_STATUS} value={session.status} /></span>}
      footer={<><span className="mr-auto self-center text-[13px] text-muted">{list.length} o‘quvchi{absent > 0 && <> · <b className="text-danger">{absent} ta kelmagan</b></>}</span>
        <Button onClick={onClose}>Yopish</Button>
        {!cancelled && <Button variant="primary" disabled={!ready || list.length === 0} loading={save.isPending} onClick={() => save.mutate(undefined)}>Saqlash</Button>}</>}>
      {cancelled && <p className="mb-3 rounded-md bg-warn-soft px-3 py-2 text-warn">Bu dars bekor qilingan — davomat belgilab bo‘lmaydi.</p>}
      {!ready ? <div className="py-10 text-center"><Spinner /></div> : (
        <>
          <Field label="Dars mavzusi" className="mb-4"><Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Masalan: Present Perfect" disabled={cancelled} /></Field>
          {list.length === 0 ? <p className="py-6 text-center text-muted">Guruhda faol o‘quvchi yo‘q.</p> : (
            <>
              <div className="mb-2 flex flex-wrap gap-2"><Button size="sm" onClick={() => setAll('present')} disabled={cancelled}>Hammasi keldi</Button></div>
              <ul className="divide-y divide-line rounded-md border border-line">
                {list.map((s) => {
                  const m = marks[s.id]
                  return (
                    <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                      <span className="min-w-40 font-medium">{fullName(s)}</span>
                      <div className="flex flex-wrap items-center gap-2">
                        <Segmented options={OPTS} value={m?.status} tones={TONES} onChange={(v) => !cancelled && setMarks((p) => ({ ...p, [s.id]: { ...p[s.id], status: v } }))} />
                        {m?.status !== 'present' && <Input className="h-8 w-40" placeholder="Izoh" value={m?.note ?? ''} disabled={cancelled} onChange={(e) => setMarks((p) => ({ ...p, [s.id]: { ...p[s.id], note: e.target.value } }))} />}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </>
      )}
      {me && null}
    </Modal>
  )
}

export { ATTENDANCE_STATUS }
