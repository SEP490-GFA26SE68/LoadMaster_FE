
import { Boxes, Gauge, Layers } from 'lucide-react'
import { Navigate, useLocation } from 'react-router'

import { Logo } from '@/components/brand/Logo'
import { Lumo } from '@/components/brand/Lumo'
import { LanguageSwitch } from '@/components/LanguageSwitch'
import { Button } from '@/components/ui/Button'
import { useT } from '@/lib/i18n'

import { landingPath } from './landing'
import { LoginArtwork } from './LoginArtwork'
import { useAuth } from './AuthProvider'

const HIGHLIGHTS = [
  { icon: Gauge, textKey: 'auth.showcase.fillRate' },
  { icon: Layers, textKey: 'auth.showcase.reverseOrder' },
  { icon: Boxes, textKey: 'auth.showcase.sharedPlan' },
] as const

export function LoginPage() {
  const t = useT()
  const { user, initialized, signIn } = useAuth()
  const location = useLocation()

  const from =
    (location.state as { from?: string } | null)?.from

  if (!initialized) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-body text-text-2">
          Đang kiểm tra phiên đăng nhập...
        </p>
      </div>
    )
  }

  if (user) {
    return (
      <Navigate
        to={landingPath(user.role, from)}
        replace
      />
    )
  }

  async function handleLogin() {
    const target =
      from && from.startsWith('/') && !from.startsWith('//')
        ? from
        : '/dang-nhap'

    const redirectUri = `${window.location.origin}${target}`

    await signIn(redirectUri)
  }

  return (
    <div className="sky relative flex min-h-dvh flex-col">
      <header className="z-10 flex justify-end px-4 pt-4 lg:absolute lg:top-5 lg:right-6 lg:p-0">
        <LanguageSwitch
          tone="sky"
          className="pointer-coarse:[&_button]:size-14 pointer-coarse:[&_button]:text-body-lg"
        />
      </header>

      <main className="mx-auto flex w-full max-w-(--shell-max) flex-1 flex-col items-center justify-center gap-12 px-4 py-4 sm:py-8 lg:flex-row lg:px-6 lg:py-6">
        <div className="flex w-full max-w-120 flex-none flex-col rounded-xl bg-bg p-6 text-text shadow-e3 sm:p-8 lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto lg:p-7">
          <div className="flex flex-col gap-5 pb-5">
            <Logo size="md" tagline />

            <div className="flex items-center gap-4">
              <Lumo pose="greet" size="sm" />

              <div className="flex min-w-0 flex-col gap-1.5">
                <p className="text-small font-medium text-primary">
                  {t('auth.login.greeting')}
                </p>

                <h1 className="text-h1 font-semibold tracking-[-0.01em]">
                  {t('auth.login.title')}
                </h1>

                <p className="text-body text-text-2">
                  {t('auth.login.subtitle')}
                </p>
              </div>
            </div>
          </div>

          <Button
            type="button"
            variant="primary"
            block
            onClick={() => void handleLogin()}
          >
            {t('auth.login.submit')}
          </Button>

          <p className="mt-4 text-center text-small text-text-2">
            Bạn sẽ được chuyển đến hệ thống xác thực LoadMaster.
          </p>
        </div>

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
                <li
                  key={textKey}
                  className="flex items-start gap-3 text-body text-sky-text-2"
                >
                  <Icon
                    className="mt-0.5 size-5 flex-none text-cyan-300"
                    strokeWidth={1.5}
                    aria-hidden
                  />
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
