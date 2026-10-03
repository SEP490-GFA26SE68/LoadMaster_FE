import { Box } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useFormat, useT } from '@/lib/i18n'
import { plannerPath } from '@/lib/planner-path'
import { cn } from '@/lib/utils'
import type { AxleGauge, CandidateCardModel, CandidateMetric } from './candidate-comparison'
import { PlanThumbnail } from './PlanThumbnail'

const MONO = 'font-mono tabular-nums'
const TEXT_LINK = 'rounded-sm text-small font-medium text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'

/**
 * Một dòng chỉ số của thẻ: nhãn trái, giá trị phải, dòng phụ dưới giá trị. Giá trị tốt nhất giữa ba phương án in đậm kèm nhãn xám
 * "Tốt nhất" — dấu hiệu trung tính, không tô xanh / đỏ cho tốt / xấu (FE-5b-06). Chữ dài xuống dòng, không cắt.
 */
function Metric({ name, label, best = false, note, children }: { name: string; label: string; best?: boolean; note?: ReactNode; children: ReactNode }) {
  const t = useT()
  return (
    <div data-metric={name} data-best={best ? '' : undefined} className="flex items-start justify-between gap-3 border-t border-line-soft py-2.25 first:border-t-0">
      <dt className="pt-px text-small text-ink-2">{label}</dt>
      <dd className="m-0 flex min-w-0 flex-col items-end gap-0.5 text-right">
        <span className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
          <span className={cn('text-body text-ink-strong', best ? 'font-semibold' : 'font-medium')}>{children}</span>
          {best ? <Badge shape="tag">{t('trips.compare.best')}</Badge> : null}
        </span>
        {note ? <span className="text-fine text-ink-3">{note}</span> : null}
      </dd>
    </div>
  )
}

/**
 * Thẻ một phương án ứng viên (FE-5b-06, D-77): nhãn A · B · C và mục tiêu, MOCK RESULT, mã revision, nhãn đã duyệt / lỗi thời, ảnh thu
 * nhỏ SVG dựng từ placement thật, rồi các chỉ số của `result.metrics` — thể tích, tải trọng, tải hai nhóm trục so giới hạn, chênh mức
 * tải hai trục, trọng tâm hàng, số kiện dỡ-xếp lại, kiện chưa xếp, thời gian chạy. Chân thẻ: nút phụ "Mở trong Planner" (màn không có
 * nút primary — chọn phương án nào là việc của người dùng), và liên kết tới bản đã duyệt nếu phương án đã được duyệt.
 */
export function CandidateCard({ tripId, card, best }: {
  tripId: string
  card: CandidateCardModel
  best: Partial<Record<CandidateMetric, ReadonlySet<string>>>
}) {
  const t = useT()
  const format = useFormat()
  const isBest = (metric: CandidateMetric) => best[metric]?.has(card.id) ?? false
  const objective = t(`runs.objectives.${card.objective}`)
  const packages = (value: number) => t('trips.compare.packages', { value: format.integer(value) })
  const approvedId = card.approvedAs.at(-1)
  const { axles, centerOfGravityCm: cog } = card
  const gauge = ({ loadKg, limitKg, percent }: AxleGauge) => ({
    value: limitKg === undefined ? format.weight(loadKg) : t('trips.compare.candidates.axleValue', { load: format.weight(loadKg), limit: format.weight(limitKg) }),
    note: percent === undefined ? t('trips.compare.candidates.axleNoLimit') : t('trips.compare.candidates.axlePercent', { percent: format.percent(percent) }),
  })
  const unavailable = axles.status === 'unavailable' ? t(`trips.compare.candidates.axleUnavailable.${axles.reason}`) : null

  return (
    <Card role="region" aria-label={t('trips.compare.candidates.card', { label: card.label, objective })} data-candidate={card.label}
      className="flex min-w-0 flex-col overflow-hidden">
      <div className="flex flex-col gap-2.5 px-4.5 pt-4 pb-3.5">
        <div className="flex items-start gap-3">
          <span aria-hidden className="grid size-9 flex-none place-items-center rounded-md bg-n-100 font-display text-h2 leading-none font-bold text-ink-strong">{card.label}</span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 className="font-display text-h3 leading-5.5 font-[650] text-ink-strong font-stretch-106%">{objective}</h2>
            <p className="text-small text-ink-3">{t(`optimization.objectiveHints.${card.objective}`)}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {card.isMockResult ? <Badge shape="tag" tone="mock">MOCK RESULT</Badge> : null}
          <span className="font-mono text-caption font-semibold text-ink-2">{card.id}</span>
          {approvedId ? <Badge shape="tag" tone="cyan">{t('trips.compare.candidates.approved')}</Badge> : null}
          {card.stale ? <Badge shape="tag" tone="warning" outlined>{t('trips.compare.status.stale')}</Badge> : null}
        </div>
      </div>
      <PlanThumbnail revisionId={card.id} request={card.revision.request} placements={card.revision.result.placements}
        totalCount={card.placedCount + card.unplacedCount} className="h-44" />

      <dl className="m-0 flex flex-1 flex-col px-4.5 py-2">
        <Metric name="volume" label={t('trips.compare.candidates.metrics.volume')} best={isBest('volume')}>
          <span className={MONO}>{format.percent(card.volumeUtilizationPercent)}</span>
        </Metric>
        <Metric name="payload" label={t('trips.compare.candidates.metrics.payload')}>
          <span className={MONO}>{format.percent(card.payloadUtilizationPercent)}</span>
        </Metric>
        {axles.status === 'computed' ? (
          <>
            <Metric name="frontAxle" label={t('trips.compare.candidates.metrics.frontAxle')} note={gauge(axles.front).note}>
              <span className={MONO}>{gauge(axles.front).value}</span>
            </Metric>
            <Metric name="rearAxle" label={t('trips.compare.candidates.metrics.rearAxle')} note={gauge(axles.rear).note}>
              <span className={MONO}>{gauge(axles.rear).value}</span>
            </Metric>
            {axles.gapPercent === undefined ? null : (
              <Metric name="axleGap" label={t('trips.compare.candidates.metrics.axleGap')} best={isBest('axleGap')}>
                <span className={MONO}>{t('trips.compare.candidates.gapValue', { value: format.decimal(axles.gapPercent) })}</span>
              </Metric>
            )}
          </>
        ) : (
          <>
            <Metric name="frontAxle" label={t('trips.compare.candidates.metrics.frontAxle')} note={unavailable}>{t('trips.compare.candidates.notComputed')}</Metric>
            <Metric name="rearAxle" label={t('trips.compare.candidates.metrics.rearAxle')} note={unavailable}>{t('trips.compare.candidates.notComputed')}</Metric>
          </>
        )}
        <Metric name="centerOfGravity" label={t('trips.compare.candidates.metrics.centerOfGravity')}>
          {cog ? (
            <span className={MONO}>{t('trips.compare.candidates.cog', { x: format.decimal(cog.x), y: format.decimal(cog.y), z: format.decimal(cog.z) })}</span>
          ) : t('trips.compare.candidates.noCog')}
        </Metric>
        <Metric name="rehandling" label={t('trips.compare.candidates.metrics.rehandling')} best={isBest('rehandling')}>
          {card.rehandlingCount === undefined ? t('trips.compare.candidates.noZones') : <span className={MONO}>{packages(card.rehandlingCount)}</span>}
        </Metric>
        <Metric name="unplaced" label={t('trips.compare.candidates.metrics.unplaced')} best={isBest('unplaced')}>
          <span className={MONO}>{packages(card.unplacedCount)}</span>
        </Metric>
        <Metric name="runtime" label={t('trips.compare.candidates.metrics.runtime')}>
          <span className={MONO}>{t('trips.compare.milliseconds', { value: format.integer(card.runtimeMs) })}</span>
        </Metric>
      </dl>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border bg-surface px-4.5 py-3.5">
        <Button variant="secondary" asChild>
          <Link to={plannerPath({ tripId, jobId: card.jobId, revisionId: card.id })} aria-label={t('trips.compare.candidates.openLabel', { label: card.label })}>
            <Box strokeWidth={1.5} />{t('trips.compare.candidates.open')}
          </Link>
        </Button>
        {approvedId ? (
          <Link to={plannerPath({ tripId, jobId: card.jobId, revisionId: approvedId })} className={TEXT_LINK}>
            {t('trips.compare.candidates.openApproved', { id: approvedId })}
          </Link>
        ) : null}
      </div>
    </Card>
  )
}
