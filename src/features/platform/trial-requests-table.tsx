import { createColumnHelper } from '@tanstack/react-table'
import { createContext, use, type ReactNode } from 'react'
import type { BaseTableFeatures, ColumnMeta } from '@/components/DataTable'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useAuthSafe } from '@/features/auth/AuthProvider'
import { useFormat, useT, type TFunction } from '@/lib/i18n'
import type { TrialRequest, TrialRequestStatus } from './trial-requests-api'
import type { Step } from './TrialRequestDialog'

export function TrialStatusBadge({ status }: { status: TrialRequestStatus }) {
  const t = useT()
  const label = t(`platform.trialRequests.status.${status}`)
  if (status === 'APPROVED') return <Badge tone="success" dot="solid">{label}</Badge>
  if (status === 'REJECTED') return <Badge tone="danger" dot="solid">{label}</Badge>
  if (status === 'PENDING_ADMIN_CREATION') return <Badge tone="cyan" dot="solid">{label}</Badge>
  return <Badge tone="warning" dot="ring">{label}</Badge>
}

/** Mở yêu cầu từ ô tên hoặc nút hành động — đi qua context (AGENTS mục 5). */
export type OpenTrialHandler = (request: TrialRequest, step?: Step) => void
export const OpenTrialContext = createContext<OpenTrialHandler | null>(null)

function CustomerCell({ request }: { request: TrialRequest }) {
  const t = useT()
  const open = use(OpenTrialContext)
  return (
    <span className="flex min-w-0 flex-col items-start gap-0.5 whitespace-normal">
      <button
        type="button"
        className="line-clamp-2 text-left font-medium text-primary hover:underline"
        aria-label={t('platform.trialRequests.open', { name: request.fullName })}
        onClick={() => open?.(request, 'detail')}
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
  const t = useT()
  if (request.aiPrecheckStatus === 'PASSED') {
    return <Badge tone="success" shape="tag">{t('platform.trialRequests.detail.aiPassBadge')}</Badge>
  }
  if (request.aiPrecheckStatus === 'FAILED') {
    return <Badge tone="danger" shape="tag">{t('platform.trialRequests.detail.aiFailBadge')}</Badge>
  }
  return <span className="text-ink-3 text-caption">—</span>
}

function ManagerReviewCell({ request }: { request: TrialRequest }) {
  const t = useT()
  if (request.managerReviewedByName) {
    return (
      <span className="flex min-w-0 flex-col items-start gap-0.5 whitespace-normal">
        <span className="line-clamp-1 font-medium text-ink-1">{request.managerReviewedByName}</span>
        {request.managerReviewedByEmail ? <span className="line-clamp-1 text-caption text-ink-3">{request.managerReviewedByEmail}</span> : null}
      </span>
    )
  }
  if (request.handledByName?.startsWith('AI') || request.handledByName === t('platform.trialRequests.detail.aiHandledBadge')) {
    return <Badge tone="neutral" shape="tag">{t('platform.trialRequests.detail.aiHandledBadge')}</Badge>
  }
  if (request.status === 'PENDING') {
    return <Badge tone="warning" shape="tag">{t('platform.trialRequests.detail.unreviewed')}</Badge>
  }
  return <span className="text-ink-3 text-caption">—</span>
}

function AdminProvisionCell({ request }: { request: TrialRequest }) {
  const t = useT()
  if (request.approvedByName) {
    return (
      <span className="flex min-w-0 flex-col items-start gap-0.5 whitespace-normal">
        <span className="line-clamp-1 font-medium text-ink-1">{request.approvedByName}</span>
        {request.approvedByEmail ? <span className="line-clamp-1 text-caption text-ink-3">{request.approvedByEmail}</span> : null}
      </span>
    )
  }
  if (request.status === 'PENDING_ADMIN_CREATION') {
    return <Badge tone="cyan" shape="tag">{t('platform.trialRequests.detail.unprovisioned')}</Badge>
  }
  return <span className="text-ink-3 text-caption">—</span>
}

function CreatedCell({ request }: { request: TrialRequest }) {
  const format = useFormat()
  return <span className="font-mono tabular-nums text-ink-2">{format.time(request.createdAt)} · {format.date(request.createdAt)}</span>
}

function ActionsCell({ request }: { request: TrialRequest }) {
  const t = useT()
  const open = use(OpenTrialContext)
  const auth = useAuthSafe()
  const role = auth?.user?.role
  const isManager = role === 'systemManager'
  const isAdmin = role === 'systemAdmin'

  const canReview = isManager && request.status === 'PENDING'
  const canProvision = isAdmin && (request.status === 'PENDING_ADMIN_CREATION' || request.status === 'PENDING')

  // Đơn có thể duyệt thì không cần hiện action "Chi tiết"
  if (canReview) {
    return (
      <div className="flex items-center whitespace-nowrap">
        <Button
          type="button"
          size="sm"
          variant="primary"
          onClick={() => open?.(request, 'managerApprove')}
        >
          {t('platform.trialRequests.columns.reviewBtn')}
        </Button>
      </div>
    )
  }

  if (canProvision) {
    return (
      <div className="flex items-center whitespace-nowrap">
        <Button
          type="button"
          size="sm"
          variant="primary"
          onClick={() => open?.(request, 'approve')}
        >
          {t('platform.trialRequests.columns.provisionBtn')}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center whitespace-nowrap">
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => open?.(request, 'detail')}
      >
        {t('platform.trialRequests.columns.detailBtn')}
      </Button>
    </div>
  )
}

const helper = createColumnHelper<BaseTableFeatures, TrialRequest>()

export function createTrialColumns(t: TFunction) {
  const column = (id: string, header: string, meta: ColumnMeta, Cell: (props: { request: TrialRequest }) => ReactNode) =>
    helper.display({ id, header, meta, cell: (info) => <Cell request={info.row.original} /> })
  return helper.columns([
    column('customer', t('platform.trialRequests.columns.customer'), { width: '18%' }, CustomerCell),
    column('contact', t('platform.trialRequests.columns.contact'), { width: '16%' }, ContactCell),
    column('plan', t('platform.trialRequests.columns.plan'), { width: '10%' }, PlanCell),
    column('precheck', 'AI Pre-check', { width: '90px' }, PrecheckCell),
    column('managerReviewed', t('platform.trialRequests.columns.managerReviewed'), { width: '150px' }, ManagerReviewCell),
    column('adminProvisioned', t('platform.trialRequests.columns.adminProvisioned'), { width: '140px' }, AdminProvisionCell),
    column('createdAt', t('platform.trialRequests.columns.createdAt'), { width: '140px' }, CreatedCell),
    column('status', t('platform.trialRequests.columns.status'), { width: '130px' }, ({ request }) => <TrialStatusBadge status={request.status} />),
    column('actions', t('platform.trialRequests.columns.actions'), { width: '140px' }, ActionsCell),
  ])
}
