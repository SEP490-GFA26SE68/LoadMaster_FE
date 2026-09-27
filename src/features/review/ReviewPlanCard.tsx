import { Box, Columns2, Info } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { VehicleName } from '@/components/VehicleName'
import { useFormat, useT } from '@/lib/i18n'
import { plannerPath } from '@/lib/planner-path'
import { waitingAge } from './review-age'
import type { ReviewQueueRow } from './review-api'

/**
 * Một phương án chờ duyệt ở `/duyet` (luồng 4 Review 1, LM-104): chuyến và tuyến, xe, mục tiêu + thuật toán của lần chạy, ba số của
 * kết quả (thể tích, tải trọng, kiện chưa xếp), ghi chú của lần chạy, người chạy và đã chờ bao lâu. "Xem & duyệt" mở Planner đúng bản
 * này; "So sánh" chỉ khi chuyến có từ hai phương án chưa duyệt. `primary`: thẻ chờ lâu nhất — việc kế tiếp, nút chính duy nhất của màn.
 */
export function ReviewPlanCard({ row, primary, now }: { row: ReviewQueueRow; primary: boolean; now: Date }) {
  const t = useT()
  const format = useFormat()
  const { metrics } = row
  const age = waitingAge(row.submittedAt, now)
  const titleId = `review-${row.revisionId}`

  return (
    <Card role="article" aria-labelledby={titleId} className="flex flex-col" data-review-trip={row.tripId}>
      <CardHeader className="items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <CardTitle id={titleId}>{row.tripName}</CardTitle>
          <span className="font-mono text-caption text-ink-3 tabular-nums">{row.tripId} · {row.revisionId}</span>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {row.isMockResult ? <Badge shape="tag" tone="mock">MOCK RESULT</Badge> : null}
          {row.manuallyEdited ? <Badge shape="tag" tone="azure">{t('viewer.plan.manuallyEdited')}</Badge> : null}
        </div>
      </CardHeader>

      <CardBody className="flex flex-col gap-4">
        <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-body">
          <Term>{t('review.card.vehicle')}</Term>
          <dd className="m-0 text-ink-1">{row.vehicle ? <VehicleName name={row.vehicle.name} /> : t('runs.noValue')}</dd>
          <Term>{t('review.card.date')}</Term>
          <dd className="m-0 text-ink-1">
            {t('review.card.scheduled', { date: format.date(row.scheduledDate) })} · {t('review.card.stops', { count: row.stopCount })}
          </dd>
          <Term>{t('review.card.run')}</Term>
          <dd className="m-0 text-ink-1">
            {row.run ? `${t(`runs.objectives.${row.run.objective}`)} · ${t(`runs.algorithms.${row.run.algorithm}`)}` : t('runs.noValue')}
          </dd>
        </dl>

        <dl className="m-0 grid grid-cols-3 gap-2">
          <Metric label={t('review.card.volume')}>{format.percent(metrics.volumeUtilizationPercent)}</Metric>
          <Metric label={t('review.card.payload')}>{format.percent(metrics.payloadUtilizationPercent)}</Metric>
          <Metric label={t('review.card.unplaced')}>
            {t('review.card.unplacedValue', { count: metrics.unplacedCount })}
          </Metric>
        </dl>

        <ul aria-label={t('review.card.notes')} className="m-0 flex list-none flex-col gap-1 p-0 text-small text-ink-2">
          <Note>{t(row.enforceLifo ? 'review.card.lifoOn' : 'review.card.lifoOff')}</Note>
          <Note>{t('review.card.axle')}</Note>
        </ul>
      </CardBody>

      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line-soft px-4.5 py-3">
        <span className="mr-auto text-small text-ink-3">
          {row.submitter ? t('review.card.submittedBy', { name: row.submitter.fullName }) : t('review.card.unknownRunner')}
          {' · '}
          {age.unit === 'justNow' ? t('review.card.age.justNow') : t(`review.card.age.${age.unit}`, { count: age.count })}
        </span>
        {row.candidateCount > 1 ? (
          <Button variant="secondary" size="sm" asChild>
            <Link to={`/chuyen/${encodeURIComponent(row.tripId)}/so-sanh`} aria-label={t('review.card.compareFor', { count: row.candidateCount, trip: row.tripId })}>
              <Columns2 strokeWidth={1.5} aria-hidden />{t('review.card.compare')}
            </Link>
          </Button>
        ) : null}
        <Button variant={primary ? 'primary' : 'secondary'} size="sm" asChild>
          <Link to={plannerPath({ tripId: row.tripId, jobId: row.jobId, revisionId: row.revisionId })} aria-label={t('review.card.openFor', { trip: row.tripId })}>
            <Box strokeWidth={1.5} aria-hidden />{t('review.card.open')}
          </Link>
        </Button>
      </div>
    </Card>
  )
}

function Term({ children }: { children: ReactNode }) {
  return <dt className="text-small text-ink-3">{children}</dt>
}

function Metric({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md border border-line-soft bg-n-25 px-3 py-2">
      <dt className="text-small text-ink-3">{label}</dt>
      <dd className="m-0 font-display text-h3 font-bold text-ink-strong tabular-nums">{children}</dd>
    </div>
  )
}

function Note({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-1.5">
      <Info className="mt-0.5 size-3.5 flex-none text-ink-3" strokeWidth={1.5} aria-hidden />
      <span>{children}</span>
    </li>
  )
}
