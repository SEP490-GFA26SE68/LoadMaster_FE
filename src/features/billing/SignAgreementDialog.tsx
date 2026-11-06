import { zodResolver } from '@hookform/resolvers/zod'
import { FileSignature } from 'lucide-react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { Banner } from '@/components/Banner'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { FieldMessage } from '@/components/ui/field-styles'
import { Input } from '@/components/ui/Input'
import { useFormat, useT, type MessageKey } from '@/lib/i18n'
import type { CompanyAgreement, SignAgreementRequest } from './agreements-api'

const ERRORS = {
  signerName: 'billing.agreement.sign.errors.signerNameRequired',
  signerPhone: 'billing.agreement.sign.errors.signerPhoneRequired',
  confirm: 'billing.agreement.sign.errors.confirmRequired',
} as const satisfies Record<string, MessageKey>

const schema = z.object({
  signerName: z.string().trim().min(1, ERRORS.signerName),
  signerPhone: z.string().trim().min(1, ERRORS.signerPhone),
  confirmTerms: z.boolean().refine((value) => value, ERRORS.confirm),
})

type Values = z.infer<typeof schema>

function errorKey(message: string | undefined): MessageKey | undefined {
  return Object.values(ERRORS).find((key) => key === message)
}

/**
 * Hộp ký thoả thuận dịch vụ thử nghiệm (chỉ khi nối backend): hạn ký, nội dung thoả thuận, họ tên và số điện thoại người ký, ô đồng ý
 * điều khoản. Ký xong nơi gọi đóng hộp; kho từ chối thì hộp giữ nguyên dữ liệu đang nhập.
 */
export function SignAgreementDialog({ agreement, open, onClose, onSign, isSigning = false }: {
  agreement: CompanyAgreement | null
  open: boolean
  onClose: () => void
  onSign: (request: SignAgreementRequest) => void
  isSigning?: boolean
}) {
  return (
    <Dialog open={open && agreement !== null} onOpenChange={(next) => (next || isSigning ? undefined : onClose())}>
      <DialogContent className="w-180">{open && agreement ? <SignForm agreement={agreement} onSign={onSign} isSigning={isSigning} /> : null}</DialogContent>
    </Dialog>
  )
}

function SignForm({ agreement, onSign, isSigning }: { agreement: CompanyAgreement; onSign: (request: SignAgreementRequest) => void; isSigning: boolean }) {
  const t = useT()
  const format = useFormat()
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { signerName: '', signerPhone: '', confirmTerms: false } })
  const errors = form.formState.errors
  const confirmError = errorKey(errors.confirmTerms?.message)
  return (
    <form noValidate onSubmit={form.handleSubmit((values) => onSign(values))}>
      <DialogHeader
        icon={FileSignature}
        tone="warning"
        title={agreement.title}
        description={`${t('billing.agreement.code', { code: agreement.agreementCode })} · ${t('billing.agreement.company', { name: agreement.companyName })}`}
      />
      <div className="flex flex-col gap-5 px-7 pt-5 pb-6">
        <Banner tone="warning">
          {agreement.deadlineAt === null ? t('billing.agreement.sign.deadlineUnknown') : t('billing.agreement.sign.deadline', { date: format.date(agreement.deadlineAt) })}
        </Banner>
        <section className="flex flex-col gap-1.5" aria-labelledby="agreement-content">
          <h3 id="agreement-content" className="m-0 text-small font-semibold text-ink-2">{t('billing.agreement.sign.contentTitle')}</h3>
          <div tabIndex={0} className="max-h-60 overflow-y-auto rounded-md border border-border bg-surface p-4 text-small whitespace-pre-wrap text-ink-1">
            {agreement.content}
          </div>
        </section>
        <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
          <legend className="mb-2 p-0 text-small font-semibold text-ink-2">{t('billing.agreement.sign.signerTitle')}</legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input required label={t('billing.agreement.sign.signerName')} autoComplete="name" error={errorKey(errors.signerName?.message) ? t(ERRORS.signerName) : undefined} {...form.register('signerName')} />
            <Input required label={t('billing.agreement.sign.signerPhone')} type="tel" autoComplete="tel" className="font-mono" error={errorKey(errors.signerPhone?.message) ? t(ERRORS.signerPhone) : undefined} {...form.register('signerPhone')} />
          </div>
        </fieldset>
        <div className="flex flex-col gap-1">
          <Controller
            control={form.control}
            name="confirmTerms"
            render={({ field }) => (
              <Checkbox
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(checked === true)}
                aria-invalid={confirmError ? true : undefined}
                label={<span className="text-small text-ink-1">{t('billing.agreement.sign.confirm')}</span>}
              />
            )}
          />
          {confirmError ? <FieldMessage error={t(confirmError)} /> : null}
        </div>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="secondary" disabled={isSigning}>{t('billing.agreement.sign.cancel')}</Button>
        </DialogClose>
        <Button type="submit" variant="primary" loading={isSigning}>{t('billing.agreement.sign.submit')}</Button>
      </DialogFooter>
    </form>
  )
}
