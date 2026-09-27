import { ArrowRight, CircleAlert, CircleCheck, CircleDashed, Lock, TriangleAlert, type LucideIcon } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { get, useFormState, useWatch, type Path, type UseFormReturn } from 'react-hook-form'
import type { z } from 'zod'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { useFormat, useT, type TFunction } from '@/lib/i18n'
import type { Trip } from '@/lib/mock-db'
import { cn } from '@/lib/utils'
import { formChecks, formIssues, stopFieldOf, type FormIssue } from './trip-form-checks'
import { useRunDateText } from './trip-form-dates'
import type { TripFormValues } from './trip-form.schema'
import type { VehicleOption } from './trips-api'
import { cargoSummary } from './trip-summary'

type RowState = 'pass' | 'fail' | 'todo' | 'warn' | 'later' | 'lock'

const ROW: Record<RowState, { icon: LucideIcon; tone: string; strong: boolean }> = {
  pass: { icon: CircleCheck, tone: 'text-green-700', strong: true },
  fail: { icon: CircleAlert, tone: 'text-red-700', strong: true },
  todo: { icon: CircleDashed, tone: 'text-ink-3', strong: true },
  warn: { icon: TriangleAlert, tone: 'text-amber-700', strong: true },
  later: { icon: CircleDashed, tone: 'text-ink-3', strong: false },
  lock: { icon: Lock, tone: 'text-ink-3', strong: false },
}

/**
 * Thẻ "Kiểm tra trước khi lưu" (V2.3 TaoChuyen.jpg, SuaChuyenKhoa.jpg) đọc **trực tiếp** form đang nhập: chạy cùng schema với lỗi
 * dưới ô, không có luật riêng. Dải đầu thẻ đếm lỗi (đỏ), ô bắt buộc còn trống (xám) hoặc báo có thể lưu (xanh). Ô chưa chạm tới
 * mà còn trống chưa tính là lỗi — trước khi bấm lưu, form mới mở không đỏ cả thẻ. Dòng có lỗi nêu ô và câu lỗi, kèm nút
 * "Tới ô cần sửa" đưa con trỏ tới đúng ô.
 */
export function TripFormChecklist({ form, schema, selected, existing, locked }: {
  form: UseFormReturn<TripFormValues>
  schema: z.ZodType
  selected: VehicleOption | undefined
  existing: Trip | undefined
  locked: boolean
}) {
  const t = useT()
  const format = useFormat()
  const runDate = useRunDateText()
  const titleId = useId()
  const values = useWatch({ control: form.control })
  const { touchedFields, dirtyFields, submitCount } = useFormState({ control: form.control })
  const seen = (path: string) => submitCount > 0 || Boolean(get(touchedFields, path)) || Boolean(get(dirtyFields, path))
  const checks = formChecks(formIssues(schema, values), seen)
  const { groups } = checks

  const vehicle = selected?.vehicle
  const cargo = existing && vehicle ? cargoSummary(existing.packages, vehicle) : null
  // Tên xe không kèm biển số: dòng chi tiết ngắn, biển số đã có ở ô chọn và thẻ tóm tắt
  const modelName = vehicle?.name.split(' · ')[0] ?? ''
  const capacity = vehicle ? vehicle.innerLengthCm * vehicle.innerWidthCm * vehicle.innerHeightCm : 0
  const stops = values.stops ?? []
  const lastStop = stops.at(-1)?.name?.trim()

  const vehicleDetail = !vehicle ? null
    : cargo?.overPayload ? t('trips.create.checklist.vehicleOver', { weight: format.weight(cargo.weightKg), payload: format.weight(vehicle.maxPayloadKg) })
      : cargo && cargo.lines > 0
        ? t('trips.create.checklist.vehicleCargo', {
          vehicle: modelName, weight: format.weight(cargo.weightKg), payload: format.weight(vehicle.maxPayloadKg),
          volume: format.volumeM3(cargo.volumeCm3), capacity: format.volumeM3(capacity),
        })
        : t('trips.create.checklist.vehiclePass', { vehicle: modelName, volume: format.volumeM3(capacity), payload: format.weight(vehicle.maxPayloadKg) })

  const rows: { key: string; state: RowState; title: string; detail?: ReactNode; issue?: FormIssue | null }[] = [
    {
      key: 'name', ...issueRow(groups.name), title: t('trips.create.checklist.name'),
      detail: groups.name.state === 'pass' ? t('trips.create.checklist.namePass', { date: runDate.withDay(values.scheduledDate ?? '') ?? '' }) : undefined,
    },
    {
      key: 'vehicle', ...issueRow(groups.vehicle), title: t('trips.create.checklist.vehicle'),
      ...(groups.vehicle.state === 'pass' ? { state: cargo?.overPayload ? 'warn' : 'pass', detail: vehicleDetail } : {}),
    },
    locked
      ? { key: 'stops', state: 'lock', title: t('trips.create.checklist.stops'), detail: t('trips.create.checklist.stopsLocked') }
      : {
        key: 'stops', ...issueRow(groups.stops), title: t('trips.create.checklist.stops'),
        detail: groups.stops.state === 'pass' && lastStop ? t('trips.create.checklist.stopsPass', { count: stops.length, last: lastStop }) : undefined,
      },
    locked
      ? { key: 'cargo', state: 'lock', title: t('trips.create.checklist.cargo'), detail: t('trips.create.checklist.cargoLocked') }
      : { key: 'cargo', state: 'later', title: t('trips.create.checklist.cargo') },
  ]
  const attention = checks.failCount > 0 || checks.todoCount > 0

  const strip = checks.failCount > 0
    ? { icon: CircleAlert, tone: 'bg-red-50 text-red-700', text: t('trips.create.checklist.failCount', { count: checks.failCount }) }
    : checks.todoCount > 0
      ? { icon: CircleDashed, tone: 'bg-n-50 text-ink-2', text: t('trips.create.checklist.todoCount', { count: checks.todoCount }) }
      : { icon: CircleCheck, tone: 'bg-green-50 text-green-700', text: t('trips.create.checklist.ok') }
  const StripIcon = strip.icon

  return (
    <Card role="region" aria-labelledby={titleId}>
      <CardHeader>
        <CardTitle as="h2" id={titleId}>{t('trips.create.checklistTitle')}</CardTitle>
      </CardHeader>
      <div role="status" className={cn('mx-4.5 mt-3.5 mb-0.5 flex items-center gap-2.5 rounded-md px-3 py-2.5 text-lede font-semibold', strip.tone)}>
        <StripIcon aria-hidden className="size-4 flex-none" strokeWidth={2} />
        {strip.text}
      </div>
      <ol className="m-0 flex list-none flex-col px-4.5 pt-1 pb-1.5">
        {rows.map((row) => {
          const spec = ROW[row.state]
          const Icon = spec.icon
          return (
            <li key={row.key} className="grid grid-cols-[20px_minmax(0,1fr)] gap-2.75 border-t border-line-soft py-3.25 first:border-t-0">
              <Icon aria-hidden className={cn('mt-0.5 size-4.5', spec.tone)} strokeWidth={2} />
              <div className="min-w-0">
                <p className={cn('text-body', spec.strong ? 'font-semibold text-ink-strong' : 'font-medium text-ink-2')}>{row.title}</p>
                {row.issue ? (
                  <IssueDetail issue={row.issue} state={row.state} t={t} onGo={(path) => form.setFocus(path as Path<TripFormValues>)} />
                ) : row.detail ? (
                  <p className="mt-0.5 text-small leading-4.75 text-ink-3">{row.detail}</p>
                ) : null}
              </div>
            </li>
          )
        })}
      </ol>
      {attention ? (
        <p className="rounded-b-lg border-t border-line-soft bg-n-25 px-4.5 py-2.75 text-fine text-ink-3">{t('trips.create.checklist.foot')}</p>
      ) : null}
    </Card>
  )
}

function issueRow(group: { state: 'pass' | 'fail' | 'todo'; issue: FormIssue | null }) {
  return { state: group.state as RowState, issue: group.issue }
}

function IssueDetail({ issue, state, t, onGo }: { issue: FormIssue; state: RowState; t: TFunction; onGo: (path: string) => void }) {
  const label = issueLabel(issue.path, t)
  return (
    <>
      <p className={cn('mt-0.5 text-small leading-4.75', state === 'fail' ? 'text-red-700' : 'text-ink-3')}>
        {label ? <span className="block font-semibold">{label}</span> : null}
        {issue.message}
      </p>
      {issue.path !== 'stops' ? (
        <button
          type="button"
          onClick={() => onGo(issue.path)}
          className="mt-1.75 inline-flex items-center gap-1 rounded-sm text-small font-semibold text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {t('trips.create.checklist.goToField')}
          <ArrowRight aria-hidden className="size-3.5" strokeWidth={2} />
        </button>
      ) : null}
    </>
  )
}

/** Tên ô của một lỗi, đúng chữ nhãn của ô đó ("Số điện thoại điểm giao 2"). */
function issueLabel(path: string, t: TFunction): string | null {
  if (path === 'name') return t('trips.create.name')
  if (path === 'scheduledDate') return t('trips.create.scheduledDate')
  if (path === 'vehicleId') return t('trips.create.vehicle')
  const stop = stopFieldOf(path)
  if (!stop || !Object.hasOwn(STOP_LABEL, stop.field)) return null
  return t(STOP_LABEL[stop.field as keyof typeof STOP_LABEL], { number: stop.number })
}

const STOP_LABEL = {
  name: 'trips.create.stopName',
  address: 'trips.create.stopAddress',
  phone: 'trips.create.stopPhone',
  contactName: 'trips.create.stopContact',
} as const
