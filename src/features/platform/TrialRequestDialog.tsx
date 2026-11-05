import { ClipboardList } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { dataErrorMessage, useT } from '@/lib/i18n'
import { FactSection, Facts, useWhen } from './company-facts'
import type { TrialRequest } from './trial-requests-api'
import { TrialStatusBadge } from './trial-requests-table'
import { ApproveTrialForm, RejectTrialForm } from './TrialRequestForms'
import { useApproveTrialRequestMutation, useRejectTrialRequestMutation } from './useTrialRequestsQuery'

type Step = 'detail' | 'approve' | 'reject'

/**
 * Một yêu cầu dùng thử: chi tiết, rồi — khi còn chờ duyệt — Duyệt (nút chính) hoặc Từ chối mở form tương ứng ngay trong hộp thoại. Ghi
 * xong hộp thoại đóng kèm toast; máy chủ từ chối thì form giữ nguyên, câu lỗi ở toast.
 */
export function TrialRequestDialog({ request, onClose }: { request: TrialRequest | null; onClose: () => void }) {
  const t = useT()
  const [step, setStep] = useState<Step>('detail')
  const approve = useApproveTrialRequestMutation()
  const reject = useRejectTrialRequestMutation()
  const pending = approve.isPending || reject.isPending

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
            onSubmit={(approval) => approve.mutate({ id: request.id, approval }, {
              onSuccess: () => {
                toast.success(t('platform.trialRequests.approved', { name: request.fullName }))
                close()
              },
              onError: (error) => toast.error(dataErrorMessage(error, t)),
            })}
          />
        ) : step === 'reject' ? (
          <RejectTrialForm
            request={request}
            pending={reject.isPending}
            onBack={() => setStep('detail')}
            onSubmit={(reason) => reject.mutate({ id: request.id, reason }, {
              onSuccess: () => {
                toast.success(t('platform.trialRequests.rejected', { name: request.fullName }))
                close()
              },
              onError: (error) => toast.error(dataErrorMessage(error, t)),
            })}
          />
        ) : (
          <TrialRequestDetail request={request} onApprove={() => setStep('approve')} onReject={() => setStep('reject')} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function TrialRequestDetail({ request, onApprove, onReject }: { request: TrialRequest; onApprove: () => void; onReject: () => void }) {
  const t = useT()
  const when = useWhen()
  const missing = <span className="text-ink-3">{t('platform.trialRequests.detail.missing')}</span>
  const pending = request.status === 'PENDING'
  return (
    <>
      <DialogHeader icon={ClipboardList} title={request.fullName} description={t('platform.trialRequests.detail.sentAt', { when: when(request.createdAt) })} />
      <div className="flex max-h-[62vh] flex-col gap-5 overflow-y-auto px-7 py-5">
        <FactSection title={t('platform.trialRequests.detail.applicant')}>
          <Facts
            items={[
              [t('platform.trialRequests.detail.email'), <span className="break-all">{request.email}</span>],
              [t('platform.trialRequests.detail.phone'), request.phoneNumber ? <span className="font-mono">{request.phoneNumber}</span> : missing],
              [t('platform.trialRequests.detail.plan'), request.interestedPlanName ?? t('platform.trialRequests.noPlan')],
            ]}
          />
        </FactSection>
        <FactSection title={t('platform.trialRequests.detail.company')}>
          <Facts
            items={[
              [t('platform.trialRequests.detail.companyName'), request.companyName ?? missing],
              [t('platform.trialRequests.detail.taxCode'), request.taxCode ? <span className="font-mono">{request.taxCode}</span> : missing],
            ]}
          />
        </FactSection>
        <FactSection title={t('platform.trialRequests.detail.result')}>
          <Facts
            items={[
              [t('platform.trialRequests.detail.status'), <TrialStatusBadge status={request.status} />],
              ...(pending ? [] : [
                [t('platform.trialRequests.detail.resolvedBy'), request.approvedByName ?? '—'] as const,
                [t('platform.trialRequests.detail.resolvedAt'), when(request.resolvedAt)] as const,
              ]),
              ...(request.createdCompanyName ? [[t('platform.trialRequests.detail.createdCompany'), request.createdCompanyName] as const] : []),
              ...(request.note ? [[t('platform.trialRequests.detail.note'), <span className="whitespace-pre-wrap">{request.note}</span>] as const] : []),
            ]}
          />
        </FactSection>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="ghost">{t('platform.trialRequests.detail.close')}</Button>
        </DialogClose>
        {pending ? (
          <>
            <Button variant="secondary" onClick={onReject}>{t('platform.trialRequests.detail.reject')}</Button>
            <Button variant="primary" onClick={onApprove}>{t('platform.trialRequests.detail.approve')}</Button>
          </>
        ) : null}
      </DialogFooter>
    </>
  )
}
