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
import { resetPassword } from './auth-api'

const schema = z
  .object({
    newPassword: z
      .string()
      .min(8, 'Mật khẩu phải có ít nhất 8 ký tự'),

    confirmPassword: z
      .string()
      .min(1, 'Vui lòng nhập lại mật khẩu'),
  })
  .refine(
    (data) =>
      data.newPassword ===
      data.confirmPassword,
    {
      path: ['confirmPassword'],
      message: 'Mật khẩu nhập lại không khớp',
    },
  )

type FormValues = z.infer<typeof schema>

export function ResetPasswordPage() {
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
      setServerError('Token đặt lại mật khẩu không hợp lệ')
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
    } catch (error) {
      setServerError(
        error instanceof Error
          ? error.message
          : 'Không thể đặt lại mật khẩu',
      )
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-md rounded-xl border border-border bg-white p-8 shadow-lg">

        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <Logo size="md" />

          <div>
            <h1 className="text-h1 font-semibold">
              Đặt lại mật khẩu
            </h1>

            <p className="mt-2 text-body text-text-2">
              Tạo mật khẩu mới cho tài khoản
              LoadMaster của bạn.
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
            label="Mật khẩu mới"
            type="password"
            autoComplete="new-password"
            error={
              form.formState.errors
                .newPassword?.message
            }
            {...form.register(
              'newPassword',
            )}
          />

          <Input
            label="Nhập lại mật khẩu"
            type="password"
            autoComplete="new-password"
            error={
              form.formState.errors
                .confirmPassword?.message
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
            Đặt lại mật khẩu
          </Button>
        </form>
      </div>
    </div>
  )
}