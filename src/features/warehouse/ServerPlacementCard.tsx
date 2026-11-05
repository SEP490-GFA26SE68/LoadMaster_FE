import { useId, type ReactNode } from 'react'
import { Badge } from '@/components/ui/Badge'
import { useFormat, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { ServerPlacementState } from './server-loading'
import type { ServerPlacement } from './warehouse-server-api'

/**
 * Thẻ kiện cần xếp của phiên bản máy chủ: tên, mã vạch, mã kho kiện, điểm giao, vị trí đặt và kích thước khi đặt (cm) bằng số — khung 3D
 * (khi máy chủ trả lòng thùng) nằm dưới thẻ. Nút của bước truyền làm `children`.
 */
export function ServerPlacementCard({ placement, step, total, children }: {
  placement: ServerPlacement
  step: number
  total: number
  children: ReactNode
}) {
  const t = useT()
  const format = useFormat()
  const id = useId()
  const cm = (value: number) => format.lengthValue(value)
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4 rounded-lg border border-border bg-bg p-5 shadow-card">
      <h2 id={id} className="m-0 font-display text-h2 font-bold text-ink-strong font-stretch-106%">
        {t('serverWarehouse.session.current', { step, total })}
      </h2>
      <dl className="m-0 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        <Fact label={t('serverWarehouse.session.name')}>{placement.name}</Fact>
        <Fact label={t('serverWarehouse.session.barcode')} mono>{placement.barcode || t('serverWarehouse.unknown')}</Fact>
        <Fact label={t('serverWarehouse.session.packageId')} mono>{placement.packageId}</Fact>
        {placement.stopSequence === null ? null : (
          <Fact label={t('serverWarehouse.session.stop')}>
            {placement.stopName ? `${placement.stopSequence} · ${placement.stopName}` : placement.stopSequence}
          </Fact>
        )}
        <Fact label={t('serverWarehouse.session.size')} mono>
          {t('serverWarehouse.session.sizeValue', { length: cm(placement.lengthCm), width: cm(placement.widthCm), height: cm(placement.heightCm) })}
        </Fact>
        <div className="flex min-w-0 flex-col gap-0.5 sm:col-span-2">
          <dt className="text-ink-3">{t('serverWarehouse.session.position')}</dt>
          <dd className="m-0 font-mono text-[18px] leading-7 font-semibold text-ink-strong tabular-nums">
            {t('serverWarehouse.session.positionValue', { x: cm(placement.x), y: cm(placement.y), z: cm(placement.z) })}
          </dd>
          <dd className="m-0 text-ink-2">{t('serverWarehouse.session.positionHint')}</dd>
        </div>
      </dl>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  )
}

const OUTCOME_TONE = { confirmed: 'success', deviation: 'warning', current: 'azure', pending: 'neutral' } as const

/** Thứ tự xếp của phiên kèm trạng thái từng kiện (chữ, không chỉ màu). */
export function ServerPlacementList({ rows }: { rows: readonly { placement: ServerPlacement; state: ServerPlacementState }[] }) {
  const t = useT()
  const id = useId()
  if (rows.length === 0) return null
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3 rounded-lg border border-border bg-bg p-5 shadow-card">
      <h2 id={id} className="m-0 font-display text-h3 font-bold text-ink-strong">{t('serverWarehouse.session.list')}</h2>
      <ol aria-labelledby={id} className="m-0 flex list-none flex-col p-0">
        {rows.map(({ placement, state }, index) => (
          <li
            key={placement.id}
            aria-current={state === 'current' ? 'step' : undefined}
            className={cn('flex min-h-14 items-center gap-3 border-b border-line-soft py-2 last:border-b-0', state === 'current' && 'font-semibold')}
          >
            <span className="w-16 flex-none font-mono text-ink-3 tabular-nums">{t('serverWarehouse.session.stepLabel', { step: index + 1 })}</span>
            <span className="min-w-0 flex-1 line-clamp-2 text-ink-1">{placement.name}</span>
            <Badge tone={OUTCOME_TONE[state]} className="flex-none text-body-lg">{t(`serverWarehouse.session.outcomes.${state}`)}</Badge>
          </li>
        ))}
      </ol>
    </section>
  )
}

function Fact({ label, mono = false, children }: { label: string; mono?: boolean; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-ink-3">{label}</dt>
      <dd className={cn('m-0 font-medium break-words text-ink-strong', mono && 'font-mono tabular-nums')}>{children}</dd>
    </div>
  )
}
