import { createColumnHelper } from '@tanstack/react-table'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { DataTable, type BaseTableFeatures, type ColumnMeta } from '@/components/DataTable'
import { Badge, type BadgeDot, type BadgeTone } from '@/components/ui/Badge'
import { Card, CardHeader, CardMeta, CardTitle } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import type { Formatter } from '@/lib/format'
import { dataErrorMessage, useFormat, useT, type TFunction } from '@/lib/i18n'
import { RUN_FAILURE_CODES } from '@/lib/mock-db'
import { plannerPath } from '@/lib/planner-path'
import type { RunApproval, RunHistoryRow } from './run-history'
import { useRunHistoryQuery } from './useOptimizationRuns'

const helper = createColumnHelper<BaseTableFeatures, RunHistoryRow>()
const mono = 'font-mono text-caption tabular-nums'
const two = 'flex min-w-0 flex-col gap-0.5 whitespace-normal'
const planLink = 'self-start rounded-sm font-medium text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'

/** Chip duyệt theo ngữ pháp chấm của V2.3, cùng màu với dòng phụ của chuyến: cyan đặc = đã duyệt, hổ phách vòng rỗng = chờ duyệt. */
const APPROVAL_LOOK: Record<RunApproval, { tone: BadgeTone; dot: BadgeDot }> = {
  approved: { tone: 'cyan', dot: 'solid' },
  pending: { tone: 'warning', dot: 'ring' },
}

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
      meta: { width: '15%' } satisfies ColumnMeta,
      cell: (info) => <span className="whitespace-normal text-ink-1">{info.getValue() ?? t('runs.noValue')}</span>,
    }),
    helper.accessor('algorithm', {
      header: t('runs.columns.choice'),
      meta: { width: '18%' } satisfies ColumnMeta,
      cell: (info) => {
        const { timeLimitSeconds: seconds, randomSeed: seed } = info.row.original
        // Seed là mã để chạy lại đúng kết quả, không phải số lượng: in nguyên, không nhóm hàng nghìn
        return (
          <span className={two}>
            <span className="text-ink-1">{t(`runs.algorithms.${info.getValue()}`)}</span>
            {seconds === null ? null : (
              <span className={`${mono} text-ink-3`}>
                {t('runs.limitSeconds', { seconds: format.integer(seconds) })} · {t('runs.seed', { seed: seed === null ? t('runs.noValue') : String(seed) })}
              </span>
            )}
          </span>
        )
      },
    }),
    helper.accessor('status', {
      header: t('runs.columns.status'),
      meta: { width: '17%' } satisfies ColumnMeta,
      cell: (info) => {
        const { failureCode, id, plans } = info.row.original
        const known = failureCode === undefined ? undefined : knownFailure(failureCode)
        return (
          <span className={`${two} items-start`}>
            <Badge tone={info.getValue() === 'COMPLETED' ? 'success' : 'danger'} dot>{t(`runs.status.${info.getValue()}`)}</Badge>
            {failureCode ? (
              <span className="line-clamp-2 text-caption text-ink-2">
                {known ? t(`runs.failures.${known}`) : failureCode}
              </span>
            ) : null}
            {plans.length > 1 ? (
              <Link to={`/chuyen/${tripId}/so-sanh?lan-chay=${encodeURIComponent(id)}`} aria-label={t('runs.openCompare', { run: id })} className={`${planLink} text-caption`}>
                {t('runs.compare')}
              </Link>
            ) : null}
          </span>
        )
      },
    }),
    helper.accessor('plans', {
      header: t('runs.columns.plan'),
      cell: (info) => {
        const plans = info.getValue()
        if (plans.length === 0) return none
        return (
          <span className={two}>
            {plans.map((plan) => (
              <span key={plan.revisionId} className="flex flex-wrap items-baseline gap-x-2 text-caption">
                <Link to={plannerPath({ tripId, jobId: plan.jobId, revisionId: plan.revisionId })} aria-label={t('runs.openPlan', { revision: plan.revisionId })}
                  className={`${planLink} flex-none font-mono`}>
                  {plan.label} · {plan.revisionId}
                </Link>
                <span className="whitespace-nowrap text-ink-2">{plan.unplacedCount > 0 ? t('runs.planUnplaced', { count: plan.unplacedCount }) : t('runs.planAllPlaced')}</span>
              </span>
            ))}
          </span>
        )
      },
    }),
    helper.accessor('approval', {
      header: t('runs.columns.approval'),
      meta: { width: '124px' } satisfies ColumnMeta,
      cell: (info) => {
        const approval = info.getValue()
        if (approval === null) return none
        const approved = info.row.original.plans.filter((plan) => plan.approved).map((plan) => plan.label)
        return (
          <span className={`${two} items-start`}>
            <Badge tone={APPROVAL_LOOK[approval].tone} dot={APPROVAL_LOOK[approval].dot}>{t(`runs.approval.${approval}`)}</Badge>
            {approved.length > 0 ? <span className="text-caption text-ink-2">{t('runs.approvedPlans', { labels: format.list(approved) })}</span> : null}
          </span>
        )
      },
    }),
  ])
}

/**
 * Bảng "Lần chạy tối ưu" của Thiết lập tối ưu (luồng 3 Review 1, LM-104): mọi lần chạy của chuyến, mới nhất trước — lúc chạy, người
 * chạy, thiết lập (thuật toán đã chạy, giới hạn thời gian · seed), kết quả (lần hỏng kèm lý do; lần xong có liên kết "So sánh" mở màn so
 * sánh của lần chạy đó), ba phương án ứng viên A · B · C (FE-5b-05 — mỗi dòng mở phương án đó trong Planner, kèm xếp đủ hay còn bao
 * nhiêu kiện chưa xếp; các chỉ số khác nằm ở màn so sánh), và lần chạy đã có phương án được duyệt (kèm nhãn phương án) hay còn chờ
 * duyệt. Bảng vừa cột trái của màn ở 1.366 px: tên người chạy xuống dòng, không cắt.
 */
export function RunHistoryCard({ tripId }: { tripId: string }) {
  const t = useT()
  const format = useFormat()
  const query = useRunHistoryQuery(tripId)
  const columns = useMemo(() => createColumns(tripId, t, format), [tripId, t, format])
  const rows = query.data ?? []

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
