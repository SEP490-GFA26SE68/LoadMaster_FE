import type { ReactNode } from 'react'
import type { OptimizationResult } from '@/domain/models'
import { useFormat, useT } from '@/lib/i18n'

/**
 * Tab "Chỉ số" (LM-049): đủ `metrics` của Spec, số lấy thẳng từ kết quả, định dạng theo ngôn ngữ. Tải trục trước / sau (FE-5b-03) chỉ
 * có dòng khi kết quả tính được — xe không khai trục thì không có số nào để hiện.
 */
export function PlanMetricsPanel({ metrics }: { metrics: OptimizationResult['metrics'] }) {
  const t = useT()
  const format = useFormat()
  const cog = metrics.centerOfGravityCm
  return (
    <section className="flex flex-col gap-3 p-4 text-body-lg xl:text-body">
      <h2 className="font-display font-[650] text-sky-text">{t('viewer.plan.metrics.title')}</h2>
      <dl className="flex flex-col border-t border-glass-dark-border">
        <Row label={t('viewer.plan.metrics.totalVehicleVolume')}>{format.volumeM3(metrics.totalVehicleVolumeCm3)}</Row>
        <Row label={t('viewer.plan.metrics.usedVolume')}>{format.volumeM3(metrics.usedVolumeCm3)}</Row>
        <Row label={t('viewer.plan.metrics.volumeUtilization')}>{format.percent(metrics.volumeUtilizationPercent)}</Row>
        <Row label={t('viewer.plan.metrics.maxPayload')}>{format.weight(metrics.maxPayloadKg)}</Row>
        <Row label={t('viewer.plan.metrics.usedPayload')}>{format.weight(metrics.usedPayloadKg)}</Row>
        <Row label={t('viewer.plan.metrics.payloadUtilization')}>{format.percent(metrics.payloadUtilizationPercent)}</Row>
        <Row label={t('viewer.plan.metrics.placedCount')}>{format.integer(metrics.placedCount)}</Row>
        <Row label={t('viewer.plan.metrics.unplacedCount')}>{format.integer(metrics.unplacedCount)}</Row>
        {cog ? (
          <Row label={t('viewer.plan.metrics.centerOfGravity')}>
            {[cog.x, cog.y, cog.z].map((value) => format.length(value)).join(' · ')}
          </Row>
        ) : null}
        {metrics.frontAxleLoadKg === undefined ? null : <Row label={t('viewer.plan.metrics.frontAxleLoad')}>{format.weight(metrics.frontAxleLoadKg)}</Row>}
        {metrics.rearAxleLoadKg === undefined ? null : <Row label={t('viewer.plan.metrics.rearAxleLoad')}>{format.weight(metrics.rearAxleLoadKg)}</Row>}
        <Row label={t('viewer.plan.metrics.runtime')}>{t('viewer.plan.metrics.runtimeValue', { ms: format.integer(metrics.runtimeMs) })}</Row>
      </dl>
    </section>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b border-glass-dark-border py-2.5">
      <dt className="text-glass-dark-muted">{label}</dt>
      <dd className="text-right font-display font-semibold tabular-nums text-sky-text">{children}</dd>
    </div>
  )
}
