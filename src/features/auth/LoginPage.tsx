import { zodResolver } from '@hookform/resolvers/zod'
import { Boxes, Gauge, Layers, Lock } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { z } from 'zod'
import { Logo } from '@/components/brand/Logo'
import { Lumo } from '@/components/brand/Lumo'
import { LanguageSwitch } from '@/components/LanguageSwitch'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { useT, type MessageKey, type TFunction } from '@/lib/i18n'
import { AuthError, type AuthErrorCode } from './auth-api'
import { DemoAccounts } from './DemoAccounts'
import { landingPath } from './landing'
import { LoginArtwork } from './LoginArtwork'
import { readReturnPath, useAuth } from './AuthProvider'

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
  'role-unknown': 'auth.login.roleUnknown',
} as const satisfies Record<AuthErrorCode, MessageKey>

/** Lỗi có mã thì hiện câu của mã; lỗi khác (mạng, máy chủ) hiện câu chung "không kết nối được". */
const errorKeyOf = (error: unknown): ServerErrorKey => (error instanceof AuthError ? AUTH_ERRORS[error.code] : 'auth.login.serverUnreachable')

function ServerError({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-md border border-badge-danger-border bg-badge-danger-bg px-3 py-2 text-body text-badge-danger-fg pointer-coarse:text-body-lg"
    >
      <Lock aria-hidden className="mt-0.5 size-4 flex-none" strokeWidth={1.5} />
      <span>{message}</span>
    </p>
  )
}

type ServerErrorKey = (typeof AUTH_ERRORS)[AuthErrorCode] | 'auth.login.serverUnreachable'

/** Ô nhập và nút cao 56px, chữ 16px khi con trỏ là ngón tay: kho và tài xế đăng nhập trên máy tính bảng, điện thoại. */
const TOUCH_CONTROL = 'pointer-coarse:h-14 pointer-coarse:text-body-lg'

/** Ba giá trị sản phẩm, hiện ở cột phải. */
const HIGHLIGHTS = [
  { icon: Gauge, textKey: 'auth.showcase.fillRate' },
  { icon: Layers, textKey: 'auth.showcase.reverseOrder' },
  { icon: Boxes, textKey: 'auth.showcase.sharedPlan' },
] as const

/**
 * Đăng nhập (V2.3 đợt 7, `DangNhap.jpg`). Đây là một trong số ít màn không có dữ liệu nghiệp vụ, nên được phép dùng bố cục hai cột
 * có hình minh hoạ — xem ngoại lệ ở AGENTS.md mục 5: card trắng đặc ở trái trên nền dải trời tối toàn trang, hình xếp hàng đẳng cự
 * và ba giá trị sản phẩm ở phải. Form không dùng kính.
 */
export function LoginPage() {
  const t = useT()
  const { user, status, source, sessionError, signIn, signInWithRedirect } = useAuth()
  const viaKeycloak = source === 'keycloak'
  const navigate = useNavigate()
  const location = useLocation()
  const [serverError, setServerError] = useState<ServerErrorKey | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  })

  /** Trang người dùng định vào trước khi bị chuyển tới đây; không có (hoặc là gốc `/`) thì mở màn của vai trò. */
  const from = (location.state as { from?: string } | null)?.from

  // Chế độ Keycloak: trang định vào được nhớ trước khi sang trang đăng nhập của Keycloak, vì `location.state` không sống qua lượt đó
  if (user) return <Navigate to={landingPath(user.role, viaKeycloak ? readReturnPath() : from)} replace />

  async function onSubmit(values: FormValues) {
    setServerError(null)
    try {
      const signedIn = await signIn(values.email, values.password)
      void navigate(landingPath(signedIn.role, from), { replace: true })
    } catch (error) {
      setServerError(errorKeyOf(error))
    }
  }

  /** Chế độ Keycloak: lỗi là của lần mở lại phiên, hoặc của chính lượt chuyển sang Keycloak. */
  const ssoError = serverError ?? (sessionError === null ? null : errorKeyOf(sessionError))

  function onSsoSignIn() {
    setServerError(null)
    signInWithRedirect(from).catch((error: unknown) => setServerError(errorKeyOf(error)))
  }

  return (
    <div className="sky relative flex min-h-dvh flex-col">
      {/* Ngôn ngữ: góc phải trang (hẹp hơn 1.024px thì một hàng trên card). Điều khiển đặc, không kính — kính chỉ ở thanh điều hướng */}
      <header className="z-10 flex justify-end px-4 pt-4 lg:absolute lg:top-5 lg:right-6 lg:p-0">
        <LanguageSwitch tone="sky" className="pointer-coarse:[&_button]:size-14 pointer-coarse:[&_button]:text-body-lg" />
      </header>

      <main className="mx-auto flex w-full max-w-(--shell-max) flex-1 flex-col items-center justify-center gap-12 px-4 py-4 sm:py-8 lg:flex-row lg:px-6 lg:py-6">
        {/* Card nền đặc nổi trên nền tối: logo, lời chào của Lumo, form, rồi hộp tài khoản dùng thử cuộn trong card */}
        <div className="flex w-full max-w-120 flex-none flex-col rounded-xl bg-bg p-6 text-text shadow-e3 sm:p-8 lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto lg:p-7">
          <div className="flex flex-none flex-col gap-5 pb-5">
            <Logo size="md" tagline />

            {/* Lumo chào (LM-105): trang trí, chữ bên cạnh nói đủ */}
            <div className="flex items-center gap-4">
              <Lumo pose="greet" size="sm" className="max-sm:size-20" />
              <div className="flex min-w-0 flex-col gap-1">
                <p className="text-small font-medium text-primary pointer-coarse:text-body-lg">{t('auth.login.greeting')}</p>
                <h1 className="font-display text-h1 leading-8 font-bold tracking-[-0.3px] text-ink-strong font-stretch-112%">{t('auth.login.title')}</h1>
                <p className="text-body text-text-2 pointer-coarse:text-body-lg">{t('auth.login.subtitle')}</p>
              </div>
            </div>

            {viaKeycloak ? (
              <div className="flex flex-col gap-4">
                <p className="text-body text-text-2 pointer-coarse:text-body-lg">{t('auth.login.sso.hint')}</p>
                {ssoError ? <ServerError message={t(ssoError)} /> : null}
                <Button type="button" variant="primary" block loading={status === 'restoring'} className={TOUCH_CONTROL} onClick={onSsoSignIn}>
                  {t('auth.login.submit')}
                </Button>
                <p className="text-small text-text-3 pointer-coarse:text-body-lg">{t('auth.login.sso.sampleData')}</p>
              </div>
            ) : (
            <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <Input
                label={t('auth.login.email')}
                type="email"
                autoComplete="username"
                placeholder={t('auth.login.emailPlaceholder')}
                className={TOUCH_CONTROL}
                error={translateFieldError(t, form.formState.errors.email?.message)}
                {...form.register('email')}
              />
              <PasswordInput
                label={t('auth.login.password')}
                autoComplete="current-password"
                className={TOUCH_CONTROL}
                error={translateFieldError(t, form.formState.errors.password?.message)}
                {...form.register('password')}
              />

              {serverError ? <ServerError message={t(serverError)} /> : null}

              <Button type="submit" variant="primary" block loading={form.formState.isSubmitting} className={TOUCH_CONTROL}>
                {t('auth.login.submit')}
              </Button>
            </form>
            )}
          </div>

          {/* Tài khoản dùng thử là của kho mẫu: không có ý nghĩa khi đăng nhập bằng backend */}
          {viaKeycloak ? null : (
            <DemoAccounts
              onPick={(email, password) => {
                form.setValue('email', email)
                form.setValue('password', password)
                setServerError(null)
              }}
            />
          )}
        </div>

        {/* Cột minh hoạ: ẩn dưới 1024px để màn hẹp chỉ còn card */}
        <aside className="hidden min-w-0 max-w-220 flex-1 flex-col gap-7 lg:flex">
          <div className="rounded-xl border border-border-dark bg-[linear-gradient(180deg,var(--canvas-1)_0%,var(--canvas-2)_100%)] p-5">
            <LoginArtwork />
          </div>

          <div className="flex flex-col gap-5">
            <p className="max-w-160 font-display text-display leading-10 font-bold tracking-[-0.5px] text-pretty text-sky-text font-stretch-112%">
              {t('auth.showcase.tagline')}
            </p>
            <ul className="m-0 grid list-none gap-4 p-0 xl:grid-cols-3">
              {HIGHLIGHTS.map(({ icon: Icon, textKey }) => (
                <li key={textKey} className="flex items-start gap-3 text-body text-sky-text-2">
                  <Icon className="mt-0.5 size-5 flex-none text-cyan-300" strokeWidth={1.5} aria-hidden />
                  {t(textKey)}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </main>
    </div>
  )
}
