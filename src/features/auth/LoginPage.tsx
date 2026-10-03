import { Boxes, Gauge, Layers } from 'lucide-react'
import { Navigate, useLocation } from 'react-router'
import { Logo } from '@/components/brand/Logo'
import { Lumo } from '@/components/brand/Lumo'
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

  const {
    user,
    initialized,
    signIn,
  } = useAuth()

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
      from && from !== '/'
        ? from
        : '/dang-nhap'

    const redirectUri =
      `${window.location.origin}${target}`

    await signIn(redirectUri)
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[2fr_3fr]">

      <main className="flex flex-col items-center justify-center px-8 py-12 sm:px-14">

        <div className="flex w-full max-w-115 flex-col gap-8">

          <div className="flex flex-col gap-4">

            <Logo
              size="md"
              tagline
              className="mb-2 self-start"
            />

            <div className="flex items-center gap-4">

              <Lumo
                pose="greet"
                size="sm"
              />

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

          <p className="text-center text-small text-text-2">
            Bạn sẽ được chuyển đến hệ thống xác thực LoadMaster.
          </p>

        </div>

      </main>

      <aside
        className="
          relative hidden flex-col items-center justify-center
          overflow-hidden
          bg-[linear-gradient(180deg,var(--canvas-1)_0%,var(--canvas-2)_100%)]
          px-12 py-12
          lg:flex
        "
      >

        <div className="flex w-full max-w-180 flex-col gap-8">

          <LoginArtwork />

          <div className="flex flex-col gap-5">

            <p className="max-w-160 text-h1 leading-9 font-semibold text-pretty text-white">
              {t('auth.showcase.tagline')}
            </p>

            <ul className="m-0 flex list-none flex-col gap-3 p-0">

              {HIGHLIGHTS.map(
                ({ icon: Icon, textKey }) => (

                  <li
                    key={textKey}
                    className="flex items-start gap-3 text-body-lg text-white/75"
                  >

                    <Icon
                      className="mt-0.5 size-5 flex-none text-white/50"
                      strokeWidth={1.5}
                      aria-hidden
                    />

                    {t(textKey)}

                  </li>

                ),
              )}

            </ul>

          </div>

        </div>

      </aside>

    </div>
  )
}