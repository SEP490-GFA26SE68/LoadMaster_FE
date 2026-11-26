import { useId } from 'react'
import type { PlacementReason, PlacementWhy } from '@/features/optimization/load-plans-backend-api'
import type { Formatter } from '@/lib/format'
import { useFormat, useT, type TFunction } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { MUTED } from './scene-ui'

function reasonText(reason: PlacementReason, t: TFunction): string {
  return reason.kind === 'ZONE_STOP'
    ? t('serverPlans.why.reasons.ZONE_STOP', { stop: reason.stop })
    : t(`serverPlans.why.reasons.${reason.kind}`)
}

/** Các dòng số đo: áp lực đè · sức chịu (σ `null` là không nhận tải trên mặt), phần đáy được đỡ, khoảng cách tới cửa. Số nào vắng thì bỏ dòng. */
export function placementMeasures(why: PlacementWhy, t: TFunction, format: Formatter): string[] {
  const lines: string[] = []
  if (why.stack) {
    const { pressureKgM2, capacityKgM2 } = why.stack
    const capacity = capacityKgM2 === undefined ? []
      : [capacityKgM2 === null ? t('serverPlans.why.noTopLoad') : t('serverPlans.why.capacity', { capacity: format.integer(capacityKgM2) })]
    lines.push([t('serverPlans.why.pressure', { pressure: format.integer(pressureKgM2) }), ...capacity].join(' · '))
  }
  if (why.supportRatio !== undefined) lines.push(t('serverPlans.why.support', { value: format.percent(why.supportRatio * 100) }))
  if (why.distanceToDoorCm !== undefined) lines.push(t('serverPlans.why.door', { distance: format.length(why.distanceToDoorCm) }))
  return lines
}

/**
 * "Vì sao đặt ở đây" trong thẻ kiện đang chọn của Planner bản máy chủ: mỗi mã lý do một câu thường, rồi số đo của dịch vụ tối ưu. Kiện
 * không có lý do hay số đo nào — phương án kho mẫu, máy chủ chưa chấm, kiện đã dời / xoay trong bản chỉnh tay — thì không vẽ gì.
 */
export function PlacementWhySection({ why }: { why: PlacementWhy | undefined }) {
  const t = useT()
  const format = useFormat()
  const titleId = useId()
  if (!why) return null
  const measures = placementMeasures(why, t, format)
  if (why.reasons.length === 0 && measures.length === 0) return null
  return (
    <section data-placement-why aria-labelledby={titleId} className="flex flex-col gap-1.5 px-4 pb-3">
      <h3 id={titleId} className={cn('text-body font-semibold xl:text-note', MUTED)}>{t('serverPlans.why.title')}</h3>
      {why.reasons.length > 0 ? (
        <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-sky-text xl:text-small">
          {why.reasons.map((reason) => (
            <li key={reason.kind === 'ZONE_STOP' ? `ZONE_STOP_${reason.stop}` : reason.kind}>{reasonText(reason, t)}</li>
          ))}
        </ul>
      ) : null}
      {measures.length > 0 ? (
        <ul className="m-0 flex list-none flex-col gap-1 p-0 text-glass-dark-text/85 tabular-nums xl:text-small">
          {measures.map((line) => <li key={line}>{line}</li>)}
        </ul>
      ) : null}
    </section>
  )
}
