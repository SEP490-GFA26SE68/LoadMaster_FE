import { zodResolver } from '@hookform/resolvers/zod'
import { CheckCircle2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Button } from '@/components/ui/Button'
import { DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { Textarea } from '@/components/ui/Textarea'
import { useT, type MessageKey, type TFunction } from '@/lib/i18n'
import type { ManagerApprovePayload, TrialRequest } from './trial-requests-api'

const message = (t: TFunction, key: string | undefined) => (key === undefined ? undefined : t(key as MessageKey))

const MANAGER_APPROVE_ERRORS = {
  managerNoteTooLong: 'platform.trialRequests.managerApprove.errors.managerNoteTooLong',
} as const satisfies Record<string, MessageKey>

const managerApproveSchema = z.object({
  managerNote: z.string().trim().max(1000, MANAGER_APPROVE_ERRORS.managerNoteTooLong).optional(),
})

type ManagerApproveValues = z.output<typeof managerApproveSchema>

export type ManagerApproveTrialFormProps = {
  request: TrialRequest
  pending: boolean
  onBack: () => void
  onSubmit: (payload: ManagerApprovePayload) => void
}

/**
 * Màn hình duyệt đơn dùng thử dành cho System Manager:
 * - Hiển thị tóm tắt thông tin của Guest (Read-only, không can thiệp chỉnh sửa).
 * - System Manager nhập ghi chú chuyển giao cho System Admin (nếu có).
 * - Xác nhận 2 bước (Double-Check) trước khi chuyển giao quyền tạo tài khoản sang System Admin.
 */
export function ManagerApproveTrialForm({ request, pending, onBack, onSubmit }: ManagerApproveTrialFormProps) {
  const t = useT()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const form = useForm<z.input<typeof managerApproveSchema>, unknown, ManagerApproveValues>({
    resolver: zodResolver(managerApproveSchema),
    defaultValues: {
      managerNote: request.managerNote ?? '',
    },
  })

  const { errors } = form.formState

  function handleStageSubmit() {
    setConfirmOpen(true)
  }

  function handleConfirmed() {
    const values = form.getValues()
    onSubmit({
      managerNote: values.managerNote?.trim() ? values.managerNote.trim() : undefined,
    })
  }

  return (
    <>
      <form noValidate onSubmit={form.handleSubmit(handleStageSubmit)}>
        <DialogHeader
          icon={CheckCircle2}
          tone="success"
          title={t('platform.trialRequests.managerApprove.title', { name: request.fullName })}
          description={t('platform.trialRequests.managerApprove.description')}
        />
        <div className="flex max-h-[62vh] flex-col gap-4 overflow-y-auto px-7 py-5">
          {/* Card tóm tắt thông tin của Guest (Read-only) */}
          <div className="rounded-lg border border-line-soft bg-surface px-4 py-3 text-body">
            <h3 className="mb-2.5 text-small font-semibold text-ink-strong">{t('platform.trialRequests.managerApprove.guestInfo')}</h3>
            <div className="grid grid-cols-1 gap-2 text-small text-ink-2 sm:grid-cols-2">
              <div>
                <span className="font-medium text-ink-3">{t('platform.trialRequests.managerApprove.company')}: </span>
                <span className="font-semibold text-ink-1">{request.companyName ?? '—'}</span>
              </div>
              <div>
                <span className="font-medium text-ink-3">{t('platform.trialRequests.managerApprove.taxCode')}: </span>
                <span className="font-mono text-ink-1">{request.taxCode ?? '—'}</span>
              </div>
              <div>
                <span className="font-medium text-ink-3">{t('platform.trialRequests.managerApprove.applicant')}: </span>
                <span className="text-ink-1">{request.fullName} ({request.email})</span>
              </div>
              <div>
                <span className="font-medium text-ink-3">{t('platform.trialRequests.managerApprove.plan')}: </span>
                <span className="font-medium text-primary">{request.interestedPlanName ?? t('platform.trialRequests.noPlan')}</span>
              </div>
            </div>
          </div>

          <Textarea
            label={t('platform.trialRequests.managerApprove.managerNote')}
            placeholder={t('platform.trialRequests.managerApprove.managerNotePlaceholder')}
            rows={3}
            error={message(t, errors.managerNote?.message)}
            {...form.register('managerNote')}
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="secondary" disabled={pending} onClick={onBack}>
            {t('platform.trialRequests.managerApprove.back')}
          </Button>
          <Button type="submit" variant="primary" loading={pending}>
            {t('platform.trialRequests.managerApprove.submit')}
          </Button>
        </DialogFooter>
      </form>

      {/* Double Check Confirmation */}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('platform.trialRequests.managerApprove.confirmTitle')}
        description={t('platform.trialRequests.managerApprove.confirmMessage', {
          company: request.companyName || request.fullName,
          email: request.email,
        })}
        confirmLabel={t('platform.trialRequests.managerApprove.confirmButton')}
        cancelLabel={t('platform.trialRequests.managerApprove.cancelButton')}
        pending={pending}
        onConfirm={handleConfirmed}
      />
    </>
  )
}
