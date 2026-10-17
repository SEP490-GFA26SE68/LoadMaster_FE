import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import {
  Navigate,
  useNavigate,
  useSearchParams,
} from 'react-router'
import { z } from 'zod'

import { Logo } from '@/components/brand/Logo'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useT, type MessageKey, type TFunction } from '@/lib/i18n'
import { resetPassword } from './auth-api'

const FIELD_ERRORS = {
  passwordTooShort: 'auth.passwordReset.passwordTooShort',
  confirmRequired: 'auth.passwordReset.confirmRequired',
  passwordMismatch: 'auth.passwordReset.passwordMismatch',
} as const satisfies Record<string, MessageKey>

const schema = z
  .object({
    newPassword: z
      .string()
      .min(8, FIELD_ERRORS.passwordTooShort),

    confirmPassword: z
      .string()
      .min(1, FIELD_ERRORS.confirmRequired),
  })
  .refine(
    (data) =>
      data.newPassword ===
      data.confirmPassword,
    {
      path: ['confirmPassword'],
      message: FIELD_ERRORS.passwordMismatch,
    },
  )

type FormValues = z.infer<typeof schema>

function translateFieldError(t: TFunction, message: string | undefined): string | undefined {
  const key = Object.values(FIELD_ERRORS).find((candidate) => candidate === message)
  return key ? t(key) : undefined
}

export function ResetPasswordPage() {
  const t = useT()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const resetToken =
    searchParams.get('token')

  const [serverError, setServerError] =
    useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      newPassword: '',
      confirmPassword: '',
    },
  })

  if (!resetToken) {
    return (
      <Navigate
        to="/quen-mat-khau"
        replace
      />
    )
  }

  async function onSubmit(values: FormValues) {
    setServerError(null)

    if (!resetToken) {
      setServerError(t('auth.passwordReset.invalidToken'))
      return
    }

    try {
      await resetPassword(
        resetToken,
        values.newPassword,
      )

      navigate('/dat-lai-mat-khau/thanh-cong', {
        replace: true,
      })
    } catch {
      setServerError(t('auth.passwordReset.resetFailed'))
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-md rounded-xl border border-border bg-white p-8 shadow-lg">

        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <Logo size="md" />

          <div>
            <h1 className="text-h1 font-semibold">
              {t('auth.passwordReset.resetTitle')}
            </h1>

            <p className="mt-2 text-body text-text-2">
              {t('auth.passwordReset.resetDescription')}
            </p>
          </div>
        </div>

        <form
          noValidate
          onSubmit={form.handleSubmit(
            onSubmit,
          )}
          className="flex flex-col gap-5"
        >
          <Input
            label={t('auth.passwordReset.newPassword')}
            type="password"
            autoComplete="new-password"
            error={
              translateFieldError(t, form.formState.errors.newPassword?.message)
            }
            {...form.register(
              'newPassword',
            )}
          />

          <Input
            label={t('auth.passwordReset.confirmPassword')}
            type="password"
            autoComplete="new-password"
            error={
              translateFieldError(t, form.formState.errors.confirmPassword?.message)
            }
            {...form.register(
              'confirmPassword',
            )}
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
            loading={
              form.formState
                .isSubmitting
            }
          >
            {t('auth.passwordReset.resetSubmit')}
          </Button>
        </form>
      </div>
    </div>
  )
}
