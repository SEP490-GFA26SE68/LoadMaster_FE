import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, FileText } from 'lucide-react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { CardHeader, CardTitle } from '@/components/ui/Card'
import { Checkbox } from '@/components/ui/Checkbox'
import { PUBLIC_TOUCH } from '@/features/marketing/public-chrome'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'

const policySchema = z.object({ accepted: z.boolean().refine((value) => value) })
type PolicyValues = z.infer<typeof policySchema>

/** Bước 3 của đăng ký trả phí: đọc điều khoản và đánh dấu đồng ý mới đi tiếp được. */
export function GuestPolicyStep({
  companyName,
  loading,
  onBack,
  onSubmit,
}: {
  companyName: string
  loading: boolean
  onBack: () => void
  onSubmit: () => void
}) {
  const t = useT()
  const form = useForm<PolicyValues>({ resolver: zodResolver(policySchema), defaultValues: { accepted: false } })
  const accepted = useWatch({ control: form.control, name: 'accepted' })

  return (
    <form onSubmit={form.handleSubmit(() => onSubmit())}>
      <CardHeader>
        <CardTitle as="h2" className="text-h2">{t('guestRegistration.step3.title')}</CardTitle>
        <p className="text-small text-ink-2">{t('guestRegistration.step3.description')}</p>
      </CardHeader>

      <div className="flex flex-col gap-5 p-6 pt-0">
        <div className="max-h-60 overflow-y-auto rounded-md border border-line-soft bg-surface p-4 text-small leading-relaxed text-ink-2">
          <h4 className="mb-2 font-semibold text-ink-strong">{t('guestRegistration.step3.agreementTitle')}</h4>
          <p className="mb-2">{t('guestRegistration.step3.term1')}</p>
          <p className="mb-2">{t('guestRegistration.step3.term2')}</p>
          <p className="mb-2">{t('guestRegistration.step3.term3')}</p>
          <p>{t('guestRegistration.step3.term4')}</p>
        </div>

        <div className="flex items-start gap-3 rounded-md border border-primary/20 bg-primary/5 p-4">
          <Controller
            control={form.control}
            name="accepted"
            render={({ field }) => (
              <Checkbox
                id="policyCheck"
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(checked === true)}
                className="mt-1"
              />
            )}
          />
          <label htmlFor="policyCheck" className="cursor-pointer text-body font-normal text-ink-strong">
            {t('guestRegistration.step3.policyCheckbox', { company: companyName })}
          </label>
        </div>

        <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <Button type="button" variant="ghost" onClick={onBack} disabled={loading}>
            <ArrowLeft className="mr-1.5 size-4" /> {t('guestRegistration.step3.back')}
          </Button>
          <Button type="submit" variant="primary" loading={loading} disabled={!accepted || loading} className={cn('min-w-44', PUBLIC_TOUCH)}>
            {!loading && <FileText className="mr-1.5 size-4" />}
            {loading ? t('guestRegistration.step3.submitting') : t('guestRegistration.step3.submit')}
          </Button>
        </div>
      </div>
    </form>
  )
}
