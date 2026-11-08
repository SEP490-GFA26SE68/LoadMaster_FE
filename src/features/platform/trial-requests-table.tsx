import { createColumnHelper } from '@tanstack/react-table'
import { createContext, use, type ReactNode } from 'react'
import type { BaseTableFeatures, ColumnMeta } from '@/components/DataTable'
import { Badge } from '@/components/ui/Badge'
import { useFormat, useT, type TFunction } from '@/lib/i18n'
import type { TrialRequest, TrialRequestStatus } from './trial-requests-api'

export function TrialStatusBadge({ status }: { status: TrialRequestStatus }) {
  const t = useT()
  const label = t(`platform.trialRequests.status.${status}`)
  if (status === 'APPROVED') return <Badge tone="success" dot="solid">{label}</Badge>
  if (status === 'REJECTED') return <Badge tone="danger" dot="solid">{label}</Badge>
  if (status === 'PENDING_ADMIN_CREATION') return <Badge tone="cyan" dot="solid">{label}</Badge>
  return <Badge tone="warning" dot="ring">{label}</Badge>
}

/** Mở yêu cầu từ ô tên — hàm ô khai một lần ở cấp module, hàm mở đi qua context (AGENTS mục 5, Bảng dữ liệu). */
export const OpenTrialContext = createContext<((request: TrialRequest) => void) | null>(null)

function CustomerCell({ request }: { request: TrialRequest }) {
  const t = useT()
  const open = use(OpenTrialContext)
  return (
    <span className="flex min-w-0 flex-col items-start gap-0.5 whitespace-normal">
      <button
        type="button"
        className="line-clamp-2 text-left font-medium text-primary hover:underline"
        aria-label={t('platform.trialRequests.open', { name: request.fullName })}
        onClick={() => open?.(request)}
      >
        {request.fullName}
      </button>
      <span className="line-clamp-1 text-caption text-ink-3">
        {request.companyName ?? t('platform.trialRequests.individual')}
        {request.taxCode ? ` (MST: ${request.taxCode})` : ''}
      </span>
    </span>
  )
}

function ContactCell({ request }: { request: TrialRequest }) {
  return (
    <span className="flex min-w-0 flex-col items-start gap-0.5 whitespace-normal">
      <span className="line-clamp-1 break-all text-ink-1">{request.email}</span>
      {request.phoneNumber ? <span className="font-mono text-caption text-ink-3">{request.phoneNumber}</span> : null}
    </span>
  )
}

function PlanCell({ request }: { request: TrialRequest }) {
  const t = useT()
  if (request.interestedPlanName === null) return <span className="text-ink-3">{t('platform.trialRequests.noPlan')}</span>
  return <span className="line-clamp-2 text-ink-1">{request.interestedPlanName}</span>
}

function PrecheckCell({ request }: { request: TrialRequest }) {
  if (request.aiPrecheckStatus === 'PASSED') {
    return <Badge tone="success" shape="tag">AI Đạt</Badge>
  }
  if (request.aiPrecheckStatus === 'FAILED') {
    return <Badge tone="danger" shape="tag">AI Từ chối</Badge>
  }
  return <span className="text-ink-3 text-caption">—</span>
}

function HandlerCell({ request }: { request: TrialRequest }) {
  const handler = request.handledByName ?? request.approvedByName ?? request.managerReviewedByName
  if (!handler) return <span className="text-ink-3 text-caption">—</span>
  if (handler === 'AI tự xử lý') {
    return <Badge tone="neutral" shape="tag">AI tự xử lý</Badge>
  }
  return <span className="text-body text-ink-2">{handler}</span>
}

function CreatedCell({ request }: { request: TrialRequest }) {
  const format = useFormat()
  return <span className="font-mono tabular-nums text-ink-2">{format.time(request.createdAt)} · {format.date(request.createdAt)}</span>
}

const helper = createColumnHelper<BaseTableFeatures, TrialRequest>()

export function createTrialColumns(t: TFunction) {
  const column = (id: string, header: string, meta: ColumnMeta, Cell: (props: { request: TrialRequest }) => ReactNode) =>
    helper.display({ id, header, meta, cell: (info) => <Cell request={info.row.original} /> })
  return helper.columns([
    column('customer', t('platform.trialRequests.columns.customer'), { width: '22%' }, CustomerCell),
    column('contact', t('platform.trialRequests.columns.contact'), { width: '22%' }, ContactCell),
    column('plan', t('platform.trialRequests.columns.plan'), { width: '15%' }, PlanCell),
    column('precheck', 'AI Pre-check', { width: '100px' }, PrecheckCell),
    column('handler', 'Đảm nhận', { width: '120px' }, HandlerCell),
    column('createdAt', t('platform.trialRequests.columns.createdAt'), { width: '160px' }, CreatedCell),
    column('status', t('platform.trialRequests.columns.status'), { width: '140px' }, ({ request }) => <TrialStatusBadge status={request.status} />),
  ])
}
