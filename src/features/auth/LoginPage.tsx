import { useEffect, useState } from 'react'
import { ArrowLeft, Boxes, Gauge, Layers } from 'lucide-react'
import { Link, Navigate, useLocation } from 'react-router'
import { Logo } from '@/components/brand/Logo'
import { Lumo } from '@/components/brand/Lumo'
import { LanguageSwitch } from '@/components/LanguageSwitch'
import { SKY_FOCUS } from '@/components/sky-focus'
import { Button } from '@/components/ui/Button'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { CargoArtwork } from '@/components/CargoArtwork'
import { landingPath, PUBLIC_HOME } from './landing'
import { useAuth } from './AuthProvider'

const TOUCH_CONTROL = 'pointer-coarse:h-14 pointer-coarse:text-body-lg'

const HIGHLIGHTS = [
  { icon: Gauge, textKey: 'auth.showcase.fillRate' },
  { icon: Layers, textKey: 'auth.showcase.reverseOrder' },
  { icon: Boxes, textKey: 'auth.showcase.sharedPlan' },
] as const

export function LoginPage() {
  const t = useT()
  const { user, initialized, signIn } = useAuth()
  const location = useLocation()
  const [loginError, setLoginError] = useState(false)
  const [isRedirecting, setIsRedirecting] = useState(false)

  useEffect(() => {
    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted) {
        // Trang được khôi phục từ Back-Forward Cache
        setIsRedirecting(false)
        setLoginError(false)
      }
    }

    function handlePageHide() {
      // Đặt lại trạng thái trước khi trang bị lưu vào cache
      setIsRedirecting(false)
    }

    window.addEventListener('pageshow', handlePageShow)
    window.addEventListener('pagehide', handlePageHide)

    return () => {
      window.removeEventListener('pageshow', handlePageShow)
      window.removeEventListener('pagehide', handlePageHide)
    }
  }, [])

  const from = (location.state as { from?: string } | null)?.from

  if (!initialized) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-body text-text-2">Đang kiểm tra phiên đăng nhập...</p>
      </div>
    )
  }

  if (user) {
    return <Navigate to={landingPath(user.role, from)} replace />
  }

  async function handleLogin() {
    if (isRedirecting) return

    setLoginError(false)
    setIsRedirecting(true)

    try {
      await signIn(
        `${window.location.origin}/dang-nhap`,
      )
    } catch (error) {
      console.error(
        'Keycloak login redirect failed:',
        error,
      )
      setLoginError(true)
    } finally {
      setIsRedirecting(false)
    }
  }

  return (
    <div className="sky relative flex min-h-dvh flex-col">
      <header className="z-10 flex items-center justify-between gap-3 px-4 pt-4 lg:absolute lg:top-5 lg:right-6 lg:p-0">
        <Button asChild variant="skyGhost" className={cn(TOUCH_CONTROL, SKY_FOCUS, 'max-sm:aspect-square max-sm:px-0')}>
          <Link to={PUBLIC_HOME}>
            <ArrowLeft aria-hidden strokeWidth={1.5} />
            <span className="max-sm:sr-only">{t('auth.login.backToLanding')}</span>
          </Link>
        </Button>
        <LanguageSwitch tone="sky" className="pointer-coarse:[&_button]:size-14 pointer-coarse:[&_button]:text-body-lg" />
      </header>
      <main className="mx-auto flex w-full max-w-(--shell-max) flex-1 flex-col items-center justify-center gap-12 px-4 py-4 sm:py-8 lg:flex-row lg:px-6 lg:py-6">
        <div className="flex w-full max-w-120 flex-none flex-col rounded-xl bg-bg p-6 text-text shadow-e3 sm:p-8 lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto lg:p-7">
          <div className="flex flex-col gap-5 pb-5">
            <Logo size="md" tagline />
            <div className="flex items-center gap-4">
              <Lumo pose="greet" size="sm" />
              <div className="flex min-w-0 flex-col gap-1.5">
                <p className="text-small font-medium text-primary">{t('auth.login.greeting')}</p>
                <h1 className="text-h1 font-semibold tracking-[-0.01em]">{t('auth.login.title')}</h1>
                <p className="text-body text-text-2">{t('auth.login.subtitle')}</p>
              </div>
            </div>
          </div>
          <Button type="button" variant="primary" block loading={isRedirecting} onClick={() => void handleLogin()}>
            {t('auth.login.submit')}
          </Button>
          {loginError && <p role="alert" className="mt-4 text-center text-small text-red-600">Không thể chuyển đến hệ thống đăng nhập. Vui lòng thử lại.</p>}
          <p className="mt-4 text-center text-small text-text-2">Bạn sẽ được chuyển đến hệ thống xác thực LoadMaster.</p>
        </div>
        <aside className="hidden min-w-0 max-w-220 flex-1 flex-col gap-7 lg:flex">
          <div className="rounded-xl border border-border-dark bg-[linear-gradient(180deg,var(--canvas-1)_0%,var(--canvas-2)_100%)] p-5">
            <CargoArtwork label={t('auth.showcase.artworkLabel')} />
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
