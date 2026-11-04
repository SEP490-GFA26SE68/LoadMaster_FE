import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router'
import { Logo } from '@/components/brand/Logo'
import { LanguageSwitch } from '@/components/LanguageSwitch'
import { SKY_FOCUS } from '@/components/sky-focus'
import { Button } from '@/components/ui/Button'
import { useT, type MessageKey } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { useAuth } from './AuthProvider'
import { CodeStep, EmailStep, PasswordStep, TOUCH_CONTROL } from './PasswordResetSteps'

type Step = { name: 'email'; notice: MessageKey | null } | { name: 'code' } | { name: 'password'; resetToken: string } | { name: 'done' }

const STEP_TITLES = {
  email: 'auth.reset.email.title',
  code: 'auth.reset.code.title',
  password: 'auth.reset.password.title',
  done: 'auth.reset.done.title',
} as const satisfies Record<Step['name'], MessageKey>

/**
 * Đặt mật khẩu mới `/quen-mat-khau` (ngoài `RequireAuth`): email → mã 6 chữ số gửi qua email → mật khẩu mới, ngay trong app. Mở từ
 * "Quên mật khẩu?" của màn đăng nhập, từ lỗi "cần đặt mật khẩu mới" (mật khẩu tạm) và từ thẻ Mật khẩu của Hồ sơ; `?email=` điền sẵn.
 * Chỉ có khi đăng nhập bằng máy chủ — kho mẫu không gửi được mã, nên chế độ kho mẫu về màn đăng nhập.
 * Cùng nền dải trời và card trắng đặc với màn đăng nhập, không hình minh hoạ: màn một việc.
 */
export function PasswordResetPage() {
  const t = useT()
  const { source, user } = useAuth()
  const [params] = useSearchParams()
  const [email, setEmail] = useState(() => params.get('email') ?? '')
  const [step, setStep] = useState<Step>({ name: 'email', notice: null })
  const headingRef = useRef<HTMLHeadingElement>(null)
  const firstStep = useRef(true)

  // Sang bước mới thì tiêu đề bước nhận focus, để trình đọc màn hình đọc bước đó (lần mở trang đầu thì không cướp focus)
  useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false
      return
    }
    headingRef.current?.focus()
  }, [step.name])

  if (source !== 'keycloak') return <Navigate to="/dang-nhap" replace />

  // Người đang đăng nhập (mở từ Hồ sơ) quay về Hồ sơ; khách quay về màn đăng nhập
  const back = user ? { to: '/ho-so', label: t('auth.reset.backToProfile') } : { to: '/dang-nhap', label: t('auth.reset.backToLogin') }

  return (
    <div className="sky relative flex min-h-dvh flex-col">
      <header className="z-10 flex items-center justify-between gap-3 px-4 pt-4 lg:px-6 lg:pt-5">
        <Button asChild variant="skyGhost" className={cn(TOUCH_CONTROL, SKY_FOCUS, 'max-sm:aspect-square max-sm:px-0')}>
          <Link to={back.to}>
            <ArrowLeft aria-hidden strokeWidth={1.5} />
            <span className="max-sm:sr-only">{back.label}</span>
          </Link>
        </Button>
        <LanguageSwitch tone="sky" className="pointer-coarse:[&_button]:size-14 pointer-coarse:[&_button]:text-body-lg" />
      </header>

      <main className="flex w-full flex-1 flex-col items-center justify-center px-4 py-6">
        <div className="flex w-full max-w-120 flex-col gap-5 rounded-xl bg-bg p-6 text-text shadow-e3 sm:p-8">
          <Logo size="md" />
          <div className="flex flex-col gap-1">
            <p className="text-small font-medium text-primary pointer-coarse:text-body-lg">{t('auth.reset.title')}</p>
            <h1 ref={headingRef} tabIndex={-1} className="font-display text-h1 leading-8 font-bold tracking-[-0.3px] text-ink-strong font-stretch-112% outline-none">
              {t(STEP_TITLES[step.name])}
            </h1>
          </div>

          {step.name === 'email' ? (
            <EmailStep
              defaultEmail={email}
              notice={step.notice}
              onSent={(sentTo) => {
                setEmail(sentTo)
                setStep({ name: 'code' })
              }}
            />
          ) : null}
          {step.name === 'code' ? (
            <CodeStep
              email={email}
              onVerified={(resetToken) => setStep({ name: 'password', resetToken })}
              onChangeEmail={() => setStep({ name: 'email', notice: null })}
            />
          ) : null}
          {step.name === 'password' ? (
            <PasswordStep
              email={email}
              resetToken={step.resetToken}
              onDone={() => setStep({ name: 'done' })}
              onExpired={() => setStep({ name: 'email', notice: 'auth.reset.errors.expired' })}
            />
          ) : null}
          {step.name === 'done' ? (
            <div role="status" className="flex flex-col gap-4">
              <p className="flex items-start gap-2 text-body text-text-2 pointer-coarse:text-body-lg">
                <CheckCircle2 aria-hidden strokeWidth={1.5} className="mt-0.5 size-5 flex-none text-success" />
                {t(user ? 'auth.reset.done.bodySignedIn' : 'auth.reset.done.body')}
              </p>
              <Button asChild variant="primary" block className={TOUCH_CONTROL}>
                <Link to={back.to}>{back.label}</Link>
              </Button>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  )
}
