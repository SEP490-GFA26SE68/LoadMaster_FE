import { ClipboardList } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { useAuthSafe } from '@/features/auth/AuthProvider'
import { dataErrorMessage, useT } from '@/lib/i18n'
import { FactSection, Facts, useWhen } from './company-facts'
import { ManagerApproveTrialForm } from './ManagerApproveTrialForm'
import type { TrialRequest } from './trial-requests-api'
import { TrialStatusBadge } from './trial-requests-table'
import { ApproveTrialForm, RejectTrialForm } from './TrialRequestForms'
import {
  useApproveTrialRequestMutation,
  useManagerApproveTrialRequestMutation,
  useManagerRejectTrialRequestMutation,
  useRejectTrialRequestMutation,
} from './useTrialRequestsQuery'

export type Step = 'detail' | 'managerApprove' | 'approve' | 'reject'

export type TrialRequestDialogProps = {
  request: TrialRequest | null
  initialStep?: Step
  onClose: () => void
}

/**
 * Một yêu cầu dùng thử: chi tiết, kết quả AI pre-check, phân quyền duyệt giữa System Manager và System Admin.
 */
export function TrialRequestDialog({ request, initialStep = 'detail', onClose }: TrialRequestDialogProps) {
  const t = useT()
  const [step, setStep] = useState<Step>(initialStep)

  useEffect(() => {
    setStep(initialStep)
  }, [request?.id, initialStep])

  const approve = useApproveTrialRequestMutation()
  const reject = useRejectTrialRequestMutation()
  const managerApprove = useManagerApproveTrialRequestMutation()
  const managerReject = useManagerRejectTrialRequestMutation()
  const pending = approve.isPending || reject.isPending || managerApprove.isPending || managerReject.isPending

  function close() {
    setStep('detail')
    onClose()
  }

  return (
    <Dialog open={request !== null} onOpenChange={(open) => (open || pending ? undefined : close())}>
      <DialogContent className="w-160">
        {request === null ? null : step === 'managerApprove' ? (
          <ManagerApproveTrialForm
            request={request}
            pending={managerApprove.isPending}
            onBack={() => setStep('detail')}
            onSubmit={(payload) =>
              managerApprove.mutate(
                { id: request.id, payload },
                {
                  onSuccess: () => {
                    toast.success(t('platform.trialRequests.detail.managerApprovedToast', { name: request.fullName }))
                    close()
                  },
                  onError: (error) => toast.error(dataErrorMessage(error, t)),
                },
              )
            }
          />
        ) : step === 'approve' ? (
          <ApproveTrialForm
            request={request}
            pending={approve.isPending}
            onBack={() => setStep('detail')}
            onSubmit={(approval) =>
              approve.mutate(
                { id: request.id, approval },
                {
                  onSuccess: () => {
                    toast.success(t('platform.trialRequests.approved', { name: request.fullName }))
                    close()
                  },
                  onError: (error) => toast.error(dataErrorMessage(error, t)),
                },
              )
            }
          />
        ) : step === 'reject' ? (
          <RejectTrialForm
            request={request}
            pending={reject.isPending || managerReject.isPending}
            onBack={() => setStep('detail')}
            onSubmit={(reason) => {
              const mutation = request.status === 'PENDING' ? managerReject : reject
              mutation.mutate(
                { id: request.id, reason },
                {
                  onSuccess: () => {
                    toast.success(t('platform.trialRequests.rejected', { name: request.fullName }))
                    close()
                  },
                  onError: (error) => toast.error(dataErrorMessage(error, t)),
                },
              )
            }}
          />
        ) : (
          <TrialRequestDetail
            request={request}
            onApprove={() => setStep('approve')}
            onReject={() => setStep('reject')}
            onManagerApprove={() => setStep('managerApprove')}
            pending={pending}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function TrialRequestDetail({
  request,
  onApprove,
  onReject,
  onManagerApprove,
  pending,
}: {
  request: TrialRequest
  onApprove: () => void
  onReject: () => void
  onManagerApprove: () => void
  pending: boolean
}) {
  const t = useT()
  const when = useWhen()
  const auth = useAuthSafe()
  const missing = <span className="text-ink-3">{t('platform.trialRequests.detail.missing')}</span>

  const role = auth?.user?.role
  const isManager = role === 'systemManager'
  const isAdmin = role === 'systemAdmin'
  const isUnspecified = !role && (request.status === 'PENDING' || request.status === 'PENDING_ADMIN_CREATION')

  const canManagerReview = isManager && request.status === 'PENDING'
  const canAdminProvision = isAdmin && (request.status === 'PENDING_ADMIN_CREATION' || request.status === 'PENDING')
  const canReject = (isManager && request.status === 'PENDING') || (isAdmin && (request.status === 'PENDING_ADMIN_CREATION' || request.status === 'PENDING')) || isUnspecified

  return (
    <>
      <DialogHeader
        icon={ClipboardList}
        title={request.fullName}
        description={t('platform.trialRequests.detail.sentAt', { when: when(request.createdAt) })}
      />
      <div className="flex max-h-[62vh] flex-col gap-5 overflow-y-auto px-7 py-5">
        <FactSection title={t('platform.trialRequests.detail.applicant')}>
          <Facts
            items={[
              [t('platform.trialRequests.detail.fullName'), request.fullName],
              [t('platform.trialRequests.detail.email'), <span key="fact-email" className="break-all">{request.email}</span>],
              [t('platform.trialRequests.detail.phone'), request.phoneNumber ? <span key="fact-phone" className="font-mono">{request.phoneNumber}</span> : missing],
              [
                t('platform.trialRequests.detail.expectedRole'),
                <Badge key="fact-role" tone="info" shape="tag">
                  {t('platform.trialRequests.detail.expectedRoleValue')}
                </Badge>,
              ],
            ]}
          />
        </FactSection>

        <FactSection title={t('platform.trialRequests.detail.company')}>
          <Facts
            items={[
              [t('platform.trialRequests.detail.companyName'), request.companyName ?? missing],
              [
                t('platform.trialRequests.detail.companyCode'),
                request.companyCode ? <span key="fact-code" className="font-mono font-bold text-ink-1">{request.companyCode}</span> : missing,
              ],
              [t('platform.trialRequests.detail.taxCode'), request.taxCode ? <span key="fact-tax" className="font-mono">{request.taxCode}</span> : missing],
              [t('platform.trialRequests.detail.companyAddress'), request.companyAddress ? <span key="fact-addr">{request.companyAddress}</span> : missing],
            ]}
          />
        </FactSection>

        <FactSection title={t('platform.trialRequests.detail.quotaSection')}>
          <Facts
            items={[
              [t('platform.trialRequests.detail.plan'), request.interestedPlanName ?? t('platform.trialRequests.noPlan')],
              [
                t('platform.trialRequests.detail.trialDays'),
                request.trialDays
                  ? t('platform.trialRequests.detail.trialDaysValue', { days: request.trialDays })
                  : t('platform.trialRequests.detail.trialDaysValue', { days: 14 }),
              ],
              [
                t('platform.trialRequests.detail.trialCredits'),
                request.trialCredits !== null && request.trialCredits !== undefined
                  ? t('platform.trialRequests.detail.trialCreditsValue', { credits: request.trialCredits })
                  : t('platform.trialRequests.detail.trialCreditsValue', { credits: 100 }),
              ],
              ...(request.note ? [[t('platform.trialRequests.detail.note'), <span key="fact-note" className="whitespace-pre-wrap">{request.note}</span>] as const] : []),
            ]}
          />
        </FactSection>

        {/* Thẩm định tự động sơ bộ (AI Pre-validation) */}
        <FactSection title={t('platform.trialRequests.detail.aiPrecheck')}>
          <Facts
            items={[
              [
                t('platform.trialRequests.detail.aiResult'),
                request.aiPrecheckStatus === 'PASSED' ? (
                  <Badge key="ai-pass" tone="success" dot="solid">{t('platform.trialRequests.detail.aiPass')}</Badge>
                ) : request.aiPrecheckStatus === 'FAILED' ? (
                  <Badge key="ai-fail" tone="danger" dot="solid">{t('platform.trialRequests.detail.aiFail')}</Badge>
                ) : (
                  <span key="ai-none" className="text-ink-3">—</span>
                ),
              ],
              ...(request.aiPrecheckReason ? [[t('platform.trialRequests.detail.aiReason'), <span key="ai-reason" className="text-body text-ink-2">{request.aiPrecheckReason}</span>] as const] : []),
              ...(request.handledByName ? [[t('platform.trialRequests.detail.handledBy'), <span key="handler" className="font-semibold text-primary">{request.handledByName}</span>] as const] : []),
            ]}
          />
        </FactSection>

        <FactSection title={t('platform.trialRequests.detail.result')}>
          <Facts
            items={[
              [t('platform.trialRequests.detail.status'), <TrialStatusBadge key="fact-status" status={request.status} />],
              [
                t('platform.trialRequests.detail.managerReviewedBy'),
                request.managerReviewedByName ? (
                  <span key="fact-mgr">
                    {request.managerReviewedByName}
                    {request.managerReviewedByEmail ? ` (${request.managerReviewedByEmail})` : ''}
                  </span>
                ) : request.status === 'PENDING' ? (
                  <Badge key="mgr-badge" tone="warning" shape="tag">{t('platform.trialRequests.detail.unreviewed')}</Badge>
                ) : (
                  missing
                ),
              ],
              ...(request.managerNote ? [[t('platform.trialRequests.detail.managerNote'), <span key="fact-mgr-note" className="whitespace-pre-wrap font-medium text-ink-1">{request.managerNote}</span>] as const] : []),
              [
                t('platform.trialRequests.detail.resolvedBy'),
                request.approvedByName ? (
                  <span key="fact-admin">
                    {request.approvedByName}
                    {request.approvedByEmail ? ` (${request.approvedByEmail})` : ''}
                  </span>
                ) : request.status === 'PENDING_ADMIN_CREATION' ? (
                  <Badge key="admin-badge" tone="cyan" shape="tag">{t('platform.trialRequests.detail.unprovisioned')}</Badge>
                ) : (
                  missing
                ),
              ],
              ...(request.resolvedAt ? [[t('platform.trialRequests.detail.resolvedAt'), when(request.resolvedAt)] as const] : []),
              ...(request.createdCompanyName ? [[t('platform.trialRequests.detail.createdCompany'), request.createdCompanyName] as const] : []),
              ...(request.rejectionReason ? [[t('platform.trialRequests.detail.rejectionReason'), <span key="fact-rej" className="text-danger font-medium">{request.rejectionReason}</span>] as const] : []),
            ]}
          />
        </FactSection>
      </div>

      <DialogFooter>
        <DialogClose asChild>
          <Button variant="ghost">{t('platform.trialRequests.detail.close')}</Button>
        </DialogClose>

        {/* Nút Từ chối */}
        {canReject ? (
          <Button variant="secondary" onClick={onReject} disabled={pending}>
            {t('platform.trialRequests.detail.reject')}
          </Button>
        ) : null}

        {/* Nút Thẩm định của System Manager */}
        {canManagerReview ? (
          <Button variant="primary" onClick={onManagerApprove} disabled={pending}>
            {t('platform.trialRequests.detail.managerApprove')}
          </Button>
        ) : null}

        {/* Nút Tạo tài khoản của System Admin */}
        {canAdminProvision ? (
          <Button variant="primary" onClick={onApprove} disabled={pending}>
            {t('platform.trialRequests.detail.adminApprove')}
          </Button>
        ) : null}

        {/* Nút Duyệt mặc định khi chưa rõ role (fallback / unit test) */}
        {isUnspecified ? (
          <Button variant="primary" onClick={onApprove} disabled={pending}>
            {t('platform.trialRequests.detail.approve')}
          </Button>
        ) : null}
      </DialogFooter>
    </>
  )
}
