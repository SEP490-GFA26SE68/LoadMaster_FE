import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'
import { z } from 'zod'

import { Logo } from '@/components/brand/Logo'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useT, type MessageKey, type TFunction } from '@/lib/i18n'
import { requestPasswordReset } from './auth-api'

const FIELD_ERRORS = {
  emailRequired: 'auth.passwordReset.emailRequired',
  emailInvalid: 'auth.passwordReset.emailInvalid',
} as const satisfies Record<string, MessageKey>

const schema = z.object({
  email: z.string().min(1, FIELD_ERRORS.emailRequired).email(FIELD_ERRORS.emailInvalid),
})

function translateFieldError(t: TFunction, message: string | undefined): string | undefined {
  const key = Object.values(FIELD_ERRORS).find((candidate) => candidate === message)
  return key ? t(key) : undefined
}

type FormValues = z.infer<typeof schema>

export function ForgotPasswordPage() {
  const t = useT()
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: '',
    },
  })

  async function onSubmit({ email }: FormValues) {
    setServerError(null)

    try {
      await requestPasswordReset(email)

      navigate(
        `/xac-thuc-otp?email=${encodeURIComponent(email)}`,
      )
    } catch {
      setServerError(t('auth.passwordReset.sendOtpFailed'))
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-md rounded-xl border border-border bg-white p-8 shadow-lg">

        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <Logo size="md" />

          <div>
            <h1 className="text-h1 font-semibold">
              {t('auth.passwordReset.forgotTitle')}
            </h1>

            <p className="mt-2 text-body text-text-2">
              {t('auth.passwordReset.forgotDescription')}
            </p>
          </div>
        </div>

        <form
          noValidate
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-5"
        >
          <Input
            label={t('auth.passwordReset.email')}
            type="email"
            autoComplete="email"
            placeholder={t('auth.passwordReset.emailPlaceholder')}
            error={translateFieldError(t, form.formState.errors.email?.message)}
            {...form.register('email')}
          />

          {serverError ? (
            <p
              role="alert"
              className="rounded-md border border-badge-danger-border bg-badge-danger-bg px-3 py-2 text-body text-badge-danger-fg"
            >
              {serverError}
            </p>
          ) : null}

          <Button
            type="submit"
            variant="primary"
            block
            loading={form.formState.isSubmitting}
          >
            {t('auth.passwordReset.sendOtp')}
          </Button>

          <Link
            to="/dang-nhap"
            className="text-center text-body text-primary hover:underline"
          >
            {t('auth.passwordReset.backToLogin')}
          </Link>
        </form>
      </div>
    </div>
  )
}
