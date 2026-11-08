import { zodResolver } from '@hookform/resolvers/zod'
import { FileCheck } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Button } from '@/components/ui/Button'
import { DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { useT, type MessageKey, type TFunction } from '@/lib/i18n'
import type { ManagerApprovePayload, TrialRequest } from './trial-requests-api'

const message = (t: TFunction, key: string | undefined) => (key === undefined ? undefined : t(key as MessageKey))

const MANAGER_APPROVE_ERRORS = {
  companyNameRequired: 'platform.trialRequests.managerApprove.errors.companyNameRequired',
  companyNameTooLong: 'platform.trialRequests.managerApprove.errors.companyNameTooLong',
  companyCodeRequired: 'platform.trialRequests.managerApprove.errors.companyCodeRequired',
  companyCodeInvalid: 'platform.trialRequests.managerApprove.errors.companyCodeInvalid',
  trialDays: 'platform.trialRequests.managerApprove.errors.trialDays',
  trialCredits: 'platform.trialRequests.managerApprove.errors.trialCredits',
  managerNoteTooLong: 'platform.trialRequests.managerApprove.errors.managerNoteTooLong',
} as const satisfies Record<string, MessageKey>

const managerApproveSchema = z.object({
  companyName: z.string().trim().min(1, MANAGER_APPROVE_ERRORS.companyNameRequired).max(200, MANAGER_APPROVE_ERRORS.companyNameTooLong),
  companyCode: z
    .string()
    .trim()
    .min(1, MANAGER_APPROVE_ERRORS.companyCodeRequired)
    .max(50, MANAGER_APPROVE_ERRORS.companyCodeInvalid)
    .regex(/^[A-Za-z0-9_-]{3,50}$/, MANAGER_APPROVE_ERRORS.companyCodeInvalid),
  companyAddress: z.string().trim().max(300).optional(),
  trialDays: z.string().trim().refine((value) => /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 365, MANAGER_APPROVE_ERRORS.trialDays),
  trialCredits: z.string().trim().refine((value) => /^\d+$/.test(value) && Number(value) >= 0, MANAGER_APPROVE_ERRORS.trialCredits),
  managerNote: z.string().trim().max(1000, MANAGER_APPROVE_ERRORS.managerNoteTooLong).optional(),
})

type ManagerApproveValues = z.output<typeof managerApproveSchema>

function suggestCompanyCode(name?: string | null): string {
  if (!name) return ''
  const ascii = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]/g, '_')
    .toUpperCase()
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
  return ascii.slice(0, 20)
}

export type ManagerApproveTrialFormProps = {
  request: TrialRequest
  pending: boolean
  onBack: () => void
  onSubmit: (payload: ManagerApprovePayload) => void
}

/**
 * Form thẩm định đơn dùng thử dành cho System Manager:
 * - Chuẩn hóa tên doanh nghiệp, mã định danh công ty (companyCode)
 * - Thiết lập thời hạn dùng thử (trialDays, mặc định 14 ngày)
 * - Thiết lập hạn mức credits (trialCredits, mặc định 100)
 * - Nhập ghi chú thẩm định gửi System Admin
 * - Xác nhận 2 bước (Double-Check) trước khi chuyển giao.
 */
export function ManagerApproveTrialForm({ request, pending, onBack, onSubmit }: ManagerApproveTrialFormProps) {
  const t = useT()
  const [confirmValues, setConfirmValues] = useState<ManagerApproveValues | null>(null)

  const defaultCode = request.companyCode || suggestCompanyCode(request.companyName)

  const form = useForm<z.input<typeof managerApproveSchema>, unknown, ManagerApproveValues>({
    resolver: zodResolver(managerApproveSchema),
    defaultValues: {
      companyName: request.companyName ?? '',
      companyCode: defaultCode,
      companyAddress: request.companyAddress ?? '',
      trialDays: request.trialDays ? String(request.trialDays) : '14',
      trialCredits: request.trialCredits !== null && request.trialCredits !== undefined ? String(request.trialCredits) : '100',
      managerNote: request.managerNote ?? '',
    },
  })

  const { errors } = form.formState

  function handleStageSubmit(values: ManagerApproveValues) {
    setConfirmValues(values)
  }

  function handleConfirmed() {
    if (!confirmValues) return
    onSubmit({
      companyName: confirmValues.companyName,
      companyCode: confirmValues.companyCode.toUpperCase(),
      companyAddress: confirmValues.companyAddress || undefined,
      trialDays: Number(confirmValues.trialDays),
      trialCredits: Number(confirmValues.trialCredits),
      managerNote: confirmValues.managerNote || undefined,
    })
  }

  return (
    <>
      <form noValidate onSubmit={form.handleSubmit(handleStageSubmit)}>
        <DialogHeader
          icon={FileCheck}
          tone="info"
          title={t('platform.trialRequests.managerApprove.title', { name: request.fullName })}
          description={t('platform.trialRequests.managerApprove.description')}
        />
        <div className="flex max-h-[62vh] flex-col gap-4 overflow-y-auto px-7 py-5">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,14rem)]">
            <Input
              label={t('platform.trialRequests.managerApprove.companyName')}
              required
              error={message(t, errors.companyName?.message)}
              {...form.register('companyName')}
            />
            <Input
              label={t('platform.trialRequests.managerApprove.companyCode')}
              required
              hint={t('platform.trialRequests.managerApprove.companyCodeHint')}
              error={message(t, errors.companyCode?.message)}
              {...form.register('companyCode')}
              onChange={(e) => {
                form.setValue('companyCode', e.target.value.toUpperCase())
              }}
            />
          </div>

          <Input
            label={t('platform.trialRequests.managerApprove.companyAddress')}
            error={message(t, errors.companyAddress?.message)}
            {...form.register('companyAddress')}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label={t('platform.trialRequests.managerApprove.trialDays')}
              type="number"
              inputMode="numeric"
              min={1}
              max={365}
              required
              error={message(t, errors.trialDays?.message)}
              {...form.register('trialDays')}
            />
            <Input
              label={t('platform.trialRequests.managerApprove.trialCredits')}
              type="number"
              inputMode="numeric"
              min={0}
              required
              error={message(t, errors.trialCredits?.message)}
              {...form.register('trialCredits')}
            />
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
        open={confirmValues !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmValues(null)
        }}
        title={t('platform.trialRequests.managerApprove.confirmTitle')}
        description={t('platform.trialRequests.managerApprove.confirmMessage', {
          company: confirmValues?.companyName ?? '',
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
