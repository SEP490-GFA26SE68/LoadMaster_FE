import { createColumnHelper } from '@tanstack/react-table'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { DataTable, type BaseTableFeatures, type ColumnMeta } from '@/components/DataTable'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader, CardMeta, CardTitle } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { ReviewStateBadge } from '@/features/review/ReviewStateBadge'
import type { Formatter } from '@/lib/format'
import { dataErrorMessage, useFormat, useT, type TFunction } from '@/lib/i18n'
import { RUN_FAILURE_CODES } from '@/lib/mock-db'
import { plannerPath } from '@/lib/planner-path'
import type { RunHistoryRow } from './run-history'
import { useRunHistoryQuery } from './useOptimizationRuns'

const helper = createColumnHelper<BaseTableFeatures, RunHistoryRow>()
const mono = 'font-mono text-caption tabular-nums'
const two = 'flex min-w-0 flex-col gap-0.5 whitespace-normal'

/** Mã lý do kho lưu dạng chuỗi; mã lạ (backend thêm sau) hiện nguyên văn thay vì câu dịch. */
const knownFailure = (value: string) => RUN_FAILURE_CODES.find((code) => code === value)

/** Cột dựng theo ngôn ngữ; ô chỉ có chữ và liên kết, không giữ trạng thái nên dựng lại khi đổi ngôn ngữ là đủ. */
function createColumns(tripId: string, t: TFunction, format: Formatter) {
  const none = <span className="text-ink-3">{t('runs.noValue')}</span>
  return helper.columns([
    helper.accessor('at', {
      header: t('runs.columns.at'),
      meta: { width: '108px' } satisfies ColumnMeta,
      cell: (info) => (
        <span className={two}>
          <span className={`${mono} text-ink-1`}>{format.time(info.getValue())} {format.dayMonth(info.getValue())}</span>
          <span className={`${mono} text-ink-3`}>{info.row.original.id}</span>
        </span>
      ),
    }),
    helper.accessor('runnerName', {
      header: t('runs.columns.runner'),
      meta: { width: '14%' } satisfies ColumnMeta,
      cell: (info) => <span className="line-clamp-2 whitespace-normal text-ink-1">{info.getValue() ?? t('runs.noValue')}</span>,
    }),
    helper.accessor('objective', {
      header: t('runs.columns.choice'),
      meta: { width: '20%' } satisfies ColumnMeta,
      cell: (info) => (
        <span className={two}>
          <span className="text-ink-1">{t(`runs.objectives.${info.getValue()}`)}</span>
          <span className="text-caption text-ink-3">{t(`runs.algorithms.${info.row.original.algorithm}`)}</span>
        </span>
      ),
    }),
    helper.accessor('timeLimitSeconds', {
      header: t('runs.columns.limits'),
      meta: { width: '132px' } satisfies ColumnMeta,
      cell: (info) => {
        const seconds = info.getValue()
        const seed = info.row.original.randomSeed
        // Seed là mã để chạy lại đúng kết quả, không phải số lượng: in nguyên, không nhóm hàng nghìn
        return seconds === null ? none : (
          <span className={`${two} ${mono} text-ink-2`}>
            <span>{t('runs.limitSeconds', { seconds: format.integer(seconds) })}</span>
            <span>{t('runs.seed', { seed: seed === null ? t('runs.noValue') : String(seed) })}</span>
          </span>
        )
      },
    }),
    helper.accessor('status', {
      header: t('runs.columns.status'),
      meta: { width: '17%' } satisfies ColumnMeta,
      cell: (info) => {
        const { failureCode } = info.row.original
        const known = failureCode === undefined ? undefined : knownFailure(failureCode)
        return (
          <span className={`${two} items-start`}>
            <Badge tone={info.getValue() === 'COMPLETED' ? 'success' : 'danger'} dot>{t(`runs.status.${info.getValue()}`)}</Badge>
            {failureCode ? (
              <span className="line-clamp-2 text-caption text-ink-2">
                {known ? t(`runs.failures.${known}`) : failureCode}
              </span>
            ) : null}
          </span>
        )
      },
    }),
    helper.accessor('revisionId', {
      header: t('runs.columns.plan'),
      meta: { width: '19%' } satisfies ColumnMeta,
      cell: (info) => {
        const row = info.row.original
        const revisionId = info.getValue()
        if (revisionId === undefined || row.jobId === undefined) return none
        const total = (row.placedCount ?? 0) + (row.unplacedCount ?? 0)
        return (
          <span className={two}>
            <Link to={plannerPath({ tripId, jobId: row.jobId, revisionId })} aria-label={t('runs.openPlan', { revision: revisionId })}
              className="self-start rounded-sm font-mono text-caption font-medium text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
              {revisionId}
            </Link>
            <span className="text-caption text-ink-2">
              {t('runs.planMetrics', {
                volume: format.percent(row.volumeUtilizationPercent ?? 0),
                payload: row.payloadUtilizationPercent === null ? t('runs.noValue') : format.percent(row.payloadUtilizationPercent),
              })}
            </span>
            <span className="text-caption text-ink-3">
              {row.unplacedCount ? t('runs.unplaced', { count: row.unplacedCount }) : t('runs.allPlaced', { count: format.integer(total) })}
            </span>
          </span>
        )
      },
    }),
    helper.accessor('review', {
      header: t('runs.columns.review'),
      meta: { width: '148px' } satisfies ColumnMeta,
      cell: (info) => {
        const review = info.getValue()
        if (review === null) return none
        return <ReviewStateBadge state={review.kind === 'decided' ? review.decision : review.kind} />
      },
    }),
  ])
}

/**
 * Bảng "Lần chạy tối ưu" của Thiết lập tối ưu (luồng 3 Review 1, LM-104): mọi lần chạy của chuyến, mới nhất trước — lúc chạy, người
 * chạy, mục tiêu + thuật toán, giới hạn thời gian + seed, kết quả (lần hỏng kèm lý do), phương án tạo ra (mở Planner) và số phận của nó.
 */
export function RunHistoryCard({ tripId }: { tripId: string }) {
  const t = useT()
  const format = useFormat()
  const query = useRunHistoryQuery(tripId)
  const columns = useMemo(() => createColumns(tripId, t, format), [tripId, t, format])
  const rows = query.data?.rows ?? []

  return (
    <Card role="region" aria-labelledby="run-history-title" data-run-history>
      <CardHeader>
        <CardTitle as="h2" id="run-history-title">{t('runs.title')}</CardTitle>
        {query.data ? <CardMeta>{t('runs.count', { count: rows.length })}</CardMeta> : null}
        <CardMeta className="basis-full">{t('optimization.history.description')}</CardMeta>
      </CardHeader>
      {query.isPending ? (
        <div className="flex justify-center py-6"><Spinner /></div>
      ) : query.error ? (
        <p className="m-0 px-4.5 py-4 text-small text-danger">{dataErrorMessage(query.error, t)}</p>
      ) : (
        <div className="relative overflow-x-auto">
          <div className="min-w-220">
            <DataTable data={[...rows]} columns={columns} appearance="paper" density="spacious" getRowId={(row) => row.id} emptyMessage={t('runs.empty')} />
          </div>
        </div>
      )}
    </Card>
  )
}
