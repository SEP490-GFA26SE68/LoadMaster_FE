import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { useT, type MessageKey, type TFunction } from '@/lib/i18n'
import { resetErrorKey, useRequestResetCode, useResetPassword, useVerifyResetCode } from './usePasswordReset'

/** Ô nhập và nút cao 56px, chữ 16px khi con trỏ là ngón tay (kho, tài xế đặt lại mật khẩu trên máy cảm ứng). */
export const TOUCH_CONTROL = 'pointer-coarse:h-14 pointer-coarse:text-body-lg'
const TEXT = 'text-body text-text-2 pointer-coarse:text-body-lg'

/** Schema giữ key từ điển thay vì câu chữ; màn dịch lúc hiển thị. */
const FIELD_ERRORS = [
  'auth.login.emailRequired',
  'auth.login.emailInvalid',
  'auth.reset.code.required',
  'auth.reset.password.tooShort',
  'auth.reset.password.mismatch',
] as const satisfies readonly MessageKey[]

function fieldError(t: TFunction, message: string | undefined): string | undefined {
  const key = FIELD_ERRORS.find((candidate) => candidate === message)
  return key ? t(key) : undefined
}

function StepError({ messageKey }: { messageKey: MessageKey | null }) {
  const t = useT()
  if (messageKey === null) return null
  return (
    <p role="alert" className="rounded-md border border-badge-danger-border bg-badge-danger-bg px-3 py-2 text-body text-badge-danger-fg pointer-coarse:text-body-lg">
      {t(messageKey)}
    </p>
  )
}

const emailSchema = z.object({ email: z.string().trim().min(1, 'auth.login.emailRequired').email('auth.login.emailInvalid') })

/** Bước 1: email của tài khoản → máy chủ gửi mã. */
export function EmailStep({ defaultEmail, notice, onSent }: { defaultEmail: string; notice: MessageKey | null; onSent: (email: string) => void }) {
  const t = useT()
  const request = useRequestResetCode()
  const form = useForm<z.infer<typeof emailSchema>>({ resolver: zodResolver(emailSchema), defaultValues: { email: defaultEmail } })
  const onSubmit = form.handleSubmit(({ email }) => request.mutate(email, { onSuccess: () => onSent(email) }))
  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
      <p className={TEXT}>{t('auth.reset.email.intro')}</p>
      <StepError messageKey={request.error ? resetErrorKey('request', request.error) : notice} />
      <Input
        label={t('auth.login.email')}
        type="email"
        autoComplete="username"
        placeholder={t('auth.login.emailPlaceholder')}
        className={TOUCH_CONTROL}
        error={fieldError(t, form.formState.errors.email?.message)}
        {...form.register('email')}
      />
      <Button type="submit" variant="primary" block loading={request.isPending} className={TOUCH_CONTROL}>
        {t('auth.reset.email.submit')}
      </Button>
    </form>
  )
}

const codeSchema = z.object({ otp: z.string().trim().regex(/^\d{6}$/, 'auth.reset.code.required') })

/** Bước 2: mã 6 chữ số trong email → vé đặt mật khẩu. Gửi lại mã được (máy chủ chặn gửi dồn trong 60 giây). */
export function CodeStep({ email, onVerified, onChangeEmail }: { email: string; onVerified: (resetToken: string) => void; onChangeEmail: () => void }) {
  const t = useT()
  const verify = useVerifyResetCode()
  const resend = useRequestResetCode()
  const [resent, setResent] = useState(false)
  const form = useForm<z.infer<typeof codeSchema>>({ resolver: zodResolver(codeSchema), defaultValues: { otp: '' } })
  const onSubmit = form.handleSubmit(({ otp }) => verify.mutate({ email, otp }, { onSuccess: onVerified }))
  const error = verify.error ? resetErrorKey('verify', verify.error) : resend.error ? resetErrorKey('request', resend.error) : null

  function handleResend() {
    setResent(false)
    verify.reset()
    resend.mutate(email, { onSuccess: () => setResent(true) })
  }

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
      <p className={TEXT}>{t('auth.reset.code.sent', { email })}</p>
      <StepError messageKey={error} />
      {/* Vùng đọc được bằng trình đọc màn hình cho lần gửi lại mã thành công */}
      <p role="status" className="text-small text-success empty:hidden pointer-coarse:text-body-lg">
        {resent ? t('auth.reset.code.resent') : ''}
      </p>
      <Input
        label={t('auth.reset.code.label')}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        className={TOUCH_CONTROL}
        error={fieldError(t, form.formState.errors.otp?.message)}
        {...form.register('otp')}
      />
      <Button type="submit" variant="primary" block loading={verify.isPending} className={TOUCH_CONTROL}>
        {t('auth.reset.code.submit')}
      </Button>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" loading={resend.isPending} className={TOUCH_CONTROL} onClick={handleResend}>
          {t('auth.reset.code.resend')}
        </Button>
        <Button type="button" variant="ghost" className={TOUCH_CONTROL} onClick={onChangeEmail}>
          {t('auth.reset.code.changeEmail')}
        </Button>
      </div>
    </form>
  )
}

const MIN_PASSWORD_LENGTH = 8

const passwordSchema = z
  .object({
    password: z.string().min(MIN_PASSWORD_LENGTH, 'auth.reset.password.tooShort'),
    confirm: z.string(),
  })
  .refine((values) => values.password === values.confirm, { path: ['confirm'], message: 'auth.reset.password.mismatch' })

/** Bước 3: mật khẩu mới. Vé hết hạn thì quay về bước 1 kèm lý do (`onExpired`). */
export function PasswordStep({
  email,
  resetToken,
  onDone,
  onExpired,
}: {
  email: string
  resetToken: string
  onDone: () => void
  onExpired: () => void
}) {
  const t = useT()
  const reset = useResetPassword()
  const form = useForm<z.infer<typeof passwordSchema>>({ resolver: zodResolver(passwordSchema), defaultValues: { password: '', confirm: '' } })
  const onSubmit = form.handleSubmit(({ password }) =>
    reset.mutate(
      { resetToken, password },
      {
        onSuccess: onDone,
        onError: (error) => {
          if (resetErrorKey('reset', error) === 'auth.reset.errors.expired') onExpired()
        },
      },
    ),
  )
  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
      <p className={TEXT}>{t('auth.reset.password.intro', { email, min: MIN_PASSWORD_LENGTH })}</p>
      <StepError messageKey={reset.error ? resetErrorKey('reset', reset.error) : null} />
      {/* Ô tên đăng nhập ẩn để trình quản lý mật khẩu lưu đúng tài khoản */}
      <input type="email" autoComplete="username" value={email} readOnly hidden />
      <PasswordInput
        label={t('auth.reset.password.label')}
        autoComplete="new-password"
        className={TOUCH_CONTROL}
        error={fieldError(t, form.formState.errors.password?.message)}
        {...form.register('password')}
      />
      <PasswordInput
        label={t('auth.reset.password.confirm')}
        autoComplete="new-password"
        className={TOUCH_CONTROL}
        error={fieldError(t, form.formState.errors.confirm?.message)}
        {...form.register('confirm')}
      />
      <Button type="submit" variant="primary" block loading={reset.isPending} className={TOUCH_CONTROL}>
        {t('auth.reset.password.submit')}
      </Button>
    </form>
  )
}
