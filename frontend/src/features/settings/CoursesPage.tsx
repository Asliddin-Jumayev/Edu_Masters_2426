import type { Course } from '@/api/types'
import { ResourcePage } from '@/components/resource'
import { Badge, Money } from '@/components/ui'
import { can } from '@/lib/permissions'

export default function CoursesPage() {
  return (
    <ResourcePage<Course>
      title="Kurslar" subtitle="O‘quv yo‘nalishlari va oylik narxlari" endpoint="/courses/" noun="kurs"
      search="Kurs nomi bo‘yicha qidirish" canCreate={can.manager} canEdit={can.manager} canDelete={(me, r) => can.manager(me) && !!r?.is_active}
      deleteLabel="Faolsizlantirish" deleteHint="Kurs faolsizlantiriladi: yangi guruh ochib bo‘lmaydi, mavjud guruhlar ishlayveradi."
      filters={[{ name: 'is_active', label: 'Holat', type: 'select', emptyLabel: 'Barcha kurslar', options: [{ value: 'true', label: 'Faol' }, { value: 'false', label: 'Nofaol' }] }]}
      columns={[
        { key: 'n', header: 'Kurs', cell: (c) => <span className="font-medium">{c.name}</span> },
        { key: 'd', header: 'Davomiyligi', cell: (c) => `${c.duration_months} oy · ${c.lessons_count} dars` },
        { key: 'p', header: 'Oylik narx', cell: (c) => <Money value={c.price} />, align: 'right' },
        { key: 'a', header: 'Yosh', cell: (c) => (c.min_age ? `${c.min_age}+` : '—') },
        { key: 's', header: 'Holat', cell: (c) => <Badge tone={c.is_active ? 'success' : 'neutral'}>{c.is_active ? 'Faol' : 'Nofaol'}</Badge> },
      ]}
      fields={[
        { name: 'name', label: 'Kurs nomi', required: true, span: 2 },
        { name: 'duration_months', label: 'Davomiyligi (oy)', type: 'number', required: true },
        { name: 'lessons_count', label: 'Darslar soni', type: 'number', required: true },
        { name: 'price', label: 'Oylik narx (so‘m)', type: 'money', required: true },
        { name: 'min_age', label: 'Minimal yosh', type: 'number', clearable: true },
        { name: 'description', label: 'Tavsif', type: 'textarea', span: 2, clearable: true },
        { name: 'is_active', label: 'Faol', type: 'checkbox', default: true },
      ]}
    />
  )
}
