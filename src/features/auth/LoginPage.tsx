import { zodResolver } from '@hookform/resolvers/zod'
import { Boxes, Gauge, Layers } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { z } from 'zod'
import { Logo } from '@/components/brand/Logo'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useT, type MessageKey, type TFunction } from '@/lib/i18n'
import { AuthError, type AuthErrorCode } from './auth-api'
import { DemoAccounts } from './DemoAccounts'
import { landingPath } from './landing'
import { LoginArtwork } from './LoginArtwork'
import { useAuth } from './AuthProvider'

/**
 * Schema giữ key từ điển thay vì câu chữ; màn dịch lúc hiển thị, nên đổi ngôn ngữ
 * khi lỗi đang hiện thì lỗi cũng đổi theo mà không phải kiểm tra lại form.
 */
const FIELD_ERRORS = {
  emailRequired: 'auth.login.emailRequired',
  emailInvalid: 'auth.login.emailInvalid',
  passwordRequired: 'auth.login.passwordRequired',
} as const satisfies Record<string, MessageKey>

const schema = z.object({
  email: z.string().min(1, FIELD_ERRORS.emailRequired).email(FIELD_ERRORS.emailInvalid),
  password: z.string().min(1, FIELD_ERRORS.passwordRequired),
})

type FormValues = z.infer<typeof schema>

function translateFieldError(t: TFunction, message: string | undefined): string | undefined {
  const key = Object.values(FIELD_ERRORS).find((candidate) => candidate === message)
  return key ? t(key) : undefined
}

const AUTH_ERRORS = {
  'invalid-credentials': 'auth.login.invalidCredentials',
  'account-suspended': 'auth.login.accountSuspended',
} as const satisfies Record<AuthErrorCode, MessageKey>

type ServerErrorKey = (typeof AUTH_ERRORS)[AuthErrorCode] | 'auth.login.serverUnreachable'

/** Ba giá trị sản phẩm, hiện ở cột phải. */
const HIGHLIGHTS = [
  { icon: Gauge, textKey: 'auth.showcase.fillRate' },
  { icon: Layers, textKey: 'auth.showcase.reverseOrder' },
  { icon: Boxes, textKey: 'auth.showcase.sharedPlan' },
] as const

/**
 * Đăng nhập. Đây là một trong số ít màn không có dữ liệu nghiệp vụ, nên được
 * phép dùng bố cục hai cột có hình minh hoạ — xem ngoại lệ ở AGENTS.md mục 5.
 */
export function LoginPage() {
  const t = useT()
  const { user, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [serverError, setServerError] = useState<ServerErrorKey | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  })

  /** Trang người dùng định vào trước khi bị chuyển tới đây; không có (hoặc là gốc `/`) thì mở màn của vai trò. */
  const from = (location.state as { from?: string } | null)?.from

  if (user) return <Navigate to={landingPath(user.role, from)} replace />

  async function onSubmit(values: FormValues) {
    setServerError(null)
    try {
      const signedIn = await signIn(values.email, values.password)
      void navigate(landingPath(signedIn.role, from), { replace: true })
    } catch (error) {
      setServerError(
        error instanceof AuthError ? AUTH_ERRORS[error.code] : 'auth.login.serverUnreachable',
      )
    }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[2fr_3fr]">
      <main className="flex flex-col items-center justify-center px-8 py-12 sm:px-14">
        <div className="flex w-full max-w-115 flex-col gap-8">
          <div className="flex flex-col gap-4">
            <Logo size="md" tagline className="mb-2 self-start" />

            <div className="flex flex-col gap-1.5">
              <h1 className="text-h1 font-semibold tracking-[-0.01em]">{t('auth.login.title')}</h1>
              <p className="text-body text-text-2">{t('auth.login.subtitle')}</p>
            </div>
          </div>

          <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <Input
              label={t('auth.login.email')}
              type="email"
              autoComplete="username"
              placeholder={t('auth.login.emailPlaceholder')}
              error={translateFieldError(t, form.formState.errors.email?.message)}
              {...form.register('email')}
            />
            <Input
              label={t('auth.login.password')}
              type="password"
              autoComplete="current-password"
              error={translateFieldError(t, form.formState.errors.password?.message)}
              {...form.register('password')}
            />

            {serverError ? (
              <p
                role="alert"
                className="rounded-md border border-badge-danger-border bg-badge-danger-bg px-3 py-2 text-body text-badge-danger-fg"
              >
                {t(serverError)}
              </p>
            ) : null}

            <Button type="submit" variant="primary" block loading={form.formState.isSubmitting}>
              {t('auth.login.submit')}
            </Button>
          </form>

          <DemoAccounts
            onPick={(email, password) => {
              form.setValue('email', email)
              form.setValue('password', password)
              setServerError(null)
            }}
          />
        </div>
      </main>

      {/* Cột minh hoạ: ẩn dưới 1024px để màn hẹp chỉ còn đúng form */}
      <aside className="relative hidden flex-col items-center justify-center overflow-hidden bg-[linear-gradient(180deg,var(--canvas-1)_0%,var(--canvas-2)_100%)] px-12 py-12 lg:flex">
        <div className="flex w-full max-w-180 flex-col gap-8">
          <LoginArtwork />

          <div className="flex flex-col gap-5">
            <p className="max-w-160 text-h1 leading-9 font-semibold text-pretty text-white">
              {t('auth.showcase.tagline')}
            </p>
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {HIGHLIGHTS.map(({ icon: Icon, textKey }) => (
                <li key={textKey} className="flex items-start gap-3 text-body-lg text-white/75">
                  <Icon className="mt-0.5 size-5 flex-none text-white/50" strokeWidth={1.5} aria-hidden />
                  {t(textKey)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>
    </div>
  )
}
