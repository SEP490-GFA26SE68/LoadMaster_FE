import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Clock, Mail, RotateCw, ShieldCheck } from 'lucide-react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { Button } from '@/components/ui/Button'
import { CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { PUBLIC_TOUCH } from '@/features/marketing/public-chrome'
import { cn } from '@/lib/utils'
import { otpSchema, type OtpValues } from './company-info-form'

/** Chữ của bước OTP; mỗi trang đăng ký lấy từ nhánh từ điển của mình. */
export type OtpTexts = {
  title: string
  description: string
  label?: string
  placeholder: string
  cooldown: string
  resend: string
  back: string
  submit: string
  submitting: string
}

/** Bước nhập mã OTP gửi qua email (react-hook-form + zod): nút xác nhận mờ tới khi đủ 6 số. */
export function RegistrationOtpForm({
  inputId,
  texts,
  loading,
  cooldown,
  onResend,
  onBack,
  onSubmit,
}: {
  inputId: string
  texts: OtpTexts
  loading: boolean
  cooldown: number
  onResend: () => void
  onBack: () => void
  onSubmit: (otp: string) => void
}) {
  const form = useForm<OtpValues>({ resolver: zodResolver(otpSchema), defaultValues: { otp: '' } })
  const otp = useWatch({ control: form.control, name: 'otp' })

  return (
    <form onSubmit={form.handleSubmit((values) => onSubmit(values.otp))}>
      <CardHeader>
        <CardTitle as="h2" className="text-h2">{texts.title}</CardTitle>
        <p className="text-small text-ink-2">{texts.description}</p>
      </CardHeader>

      <div className="flex flex-col gap-6 p-6 pt-0">
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Mail className="size-7" />
          </div>

          <div className="flex w-full max-w-xs flex-col gap-2">
            {texts.label ? <label htmlFor={inputId} className="sr-only">{texts.label}</label> : null}
            <Controller
              control={form.control}
              name="otp"
              render={({ field }) => (
                <Input
                  id={inputId}
                  type="text"
                  maxLength={6}
                  autoFocus
                  placeholder={texts.placeholder}
                  name={field.name}
                  ref={field.ref}
                  value={field.value}
                  onBlur={field.onBlur}
                  onChange={(event) => field.onChange(event.target.value.replace(/[^0-9]/g, ''))}
                  disabled={loading}
                  className={cn('text-center font-mono text-2xl tracking-widest', PUBLIC_TOUCH)}
                />
              )}
            />
          </div>

          <div className="text-caption text-ink-2">
            {cooldown > 0 ? (
              <span className="inline-flex items-center gap-1.5 text-ink-3">
                <Clock className="size-3.5" /> {texts.cooldown}
              </span>
            ) : (
              <button
                type="button"
                onClick={onResend}
                disabled={loading}
                className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
              >
                <RotateCw className="size-3.5" /> {texts.resend}
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <Button type="button" variant="ghost" onClick={onBack} disabled={loading}>
            <ArrowLeft className="mr-1.5 size-4" /> {texts.back}
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={loading}
            disabled={loading || otp.length < 6}
            className={cn('min-w-44', PUBLIC_TOUCH)}
          >
            {!loading && <ShieldCheck className="mr-1.5 size-4" />}
            {loading ? texts.submitting : texts.submit}
          </Button>
        </div>
      </div>
    </form>
  )
}
