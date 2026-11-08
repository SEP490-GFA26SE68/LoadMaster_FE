import { ClipboardList } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { useAuth } from '@/features/auth/AuthProvider'
import { dataErrorMessage, useT } from '@/lib/i18n'
import { FactSection, Facts, useWhen } from './company-facts'
import type { TrialRequest } from './trial-requests-api'
import { TrialStatusBadge } from './trial-requests-table'
import { ApproveTrialForm, RejectTrialForm } from './TrialRequestForms'
import {
  useApproveTrialRequestMutation,
  useManagerApproveTrialRequestMutation,
  useManagerRejectTrialRequestMutation,
  useRejectTrialRequestMutation,
} from './useTrialRequestsQuery'

type Step = 'detail' | 'approve' | 'reject'

/**
 * Một yêu cầu dùng thử: chi tiết, kết quả AI pre-check, phân quyền duyệt giữa System Manager và System Admin.
 */
export function TrialRequestDialog({ request, onClose }: { request: TrialRequest | null; onClose: () => void }) {
  const t = useT()
  const [step, setStep] = useState<Step>('detail')
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
        {request === null ? null : step === 'approve' ? (
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
              // Nếu là Manager thì gọi managerReject, còn Admin gọi reject
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
            onManagerApprove={() => {
              managerApprove.mutate(request.id, {
                onSuccess: () => {
                  toast.success(`Đã duyệt và chuyển giao đơn của ${request.fullName} sang System Admin.`)
                  close()
                },
                onError: (error) => toast.error(dataErrorMessage(error, t)),
              })
            }}
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
  const { user } = useAuth()
  const missing = <span className="text-ink-3">{t('platform.trialRequests.detail.missing')}</span>

  const isManager = user?.role === 'systemManager'
  const isAdmin = user?.role === 'systemAdmin'

  const canManagerReview = isManager && request.status === 'PENDING'
  const canAdminProvision = isAdmin && (request.status === 'PENDING_ADMIN_CREATION' || request.status === 'PENDING')
  const canAdminReject = isAdmin && (request.status === 'PENDING_ADMIN_CREATION' || request.status === 'PENDING')

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
              [t('platform.trialRequests.detail.email'), <span key="fact-80" className="break-all">{request.email}</span>],
              [t('platform.trialRequests.detail.phone'), request.phoneNumber ? <span key="fact-81" className="font-mono">{request.phoneNumber}</span> : missing],
              [t('platform.trialRequests.detail.plan'), request.interestedPlanName ?? t('platform.trialRequests.noPlan')],
            ]}
          />
        </FactSection>
        <FactSection title={t('platform.trialRequests.detail.company')}>
          <Facts
            items={[
              [t('platform.trialRequests.detail.companyName'), request.companyName ?? missing],
              [t('platform.trialRequests.detail.taxCode'), request.taxCode ? <span key="fact-90" className="font-mono">{request.taxCode}</span> : missing],
              ['Địa chỉ công ty', request.companyAddress ? <span key="fact-addr">{request.companyAddress}</span> : missing],
            ]}
          />
        </FactSection>

        {/* Thẩm định tự động sơ bộ (AI Pre-validation) */}
        <FactSection title="Đối soát tự động (AI Pre-check)">
          <Facts
            items={[
              [
                'Kết quả rà soát',
                request.aiPrecheckStatus === 'PASSED' ? (
                  <Badge key="ai-pass" tone="success" dot="solid">Hợp lệ (Đạt kiểm tra)</Badge>
                ) : request.aiPrecheckStatus === 'FAILED' ? (
                  <Badge key="ai-fail" tone="danger" dot="solid">Không hợp lệ</Badge>
                ) : (
                  <span key="ai-none" className="text-ink-3">—</span>
                ),
              ],
              ...(request.aiPrecheckReason ? [['Chi tiết rà soát', <span key="ai-reason" className="text-body text-ink-2">{request.aiPrecheckReason}</span>] as const] : []),
              ...(request.handledByName ? [['Người đảm nhận', <span key="handler" className="font-semibold text-primary">{request.handledByName}</span>] as const] : []),
            ]}
          />
        </FactSection>

        <FactSection title={t('platform.trialRequests.detail.result')}>
          <Facts
            items={[
              [t('platform.trialRequests.detail.status'), <TrialStatusBadge key="fact-97" status={request.status} />],
              ...(request.managerReviewedByName ? [['Manager duyệt', request.managerReviewedByName] as const] : []),
              ...(request.approvedByName ? [[t('platform.trialRequests.detail.resolvedBy'), request.approvedByName] as const] : []),
              ...(request.resolvedAt ? [[t('platform.trialRequests.detail.resolvedAt'), when(request.resolvedAt)] as const] : []),
              ...(request.createdCompanyName ? [[t('platform.trialRequests.detail.createdCompany'), request.createdCompanyName] as const] : []),
              ...(request.rejectionReason ? [['Lý do từ chối', <span key="fact-rej" className="text-danger font-medium">{request.rejectionReason}</span>] as const] : []),
              ...(request.note ? [[t('platform.trialRequests.detail.note'), <span key="fact-103" className="whitespace-pre-wrap">{request.note}</span>] as const] : []),
            ]}
          />
        </FactSection>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="ghost">{t('platform.trialRequests.detail.close')}</Button>
        </DialogClose>

        {/* Hành động của System Manager */}
        {canManagerReview ? (
          <>
            <Button variant="secondary" onClick={onReject} disabled={pending}>
              Từ chối
            </Button>
            <Button variant="primary" onClick={onManagerApprove} disabled={pending}>
              Duyệt & Chuyển sang System Admin
            </Button>
          </>
        ) : null}

        {/* Hành động của System Admin */}
        {canAdminProvision ? (
          <>
            {canAdminReject ? (
              <Button variant="secondary" onClick={onReject} disabled={pending}>
                {t('platform.trialRequests.detail.reject')}
              </Button>
            ) : null}
            <Button variant="primary" onClick={onApprove} disabled={pending}>
              Tạo tài khoản & Kích hoạt
            </Button>
          </>
        ) : null}
      </DialogFooter>
    </>
  )
}
