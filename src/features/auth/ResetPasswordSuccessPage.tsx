import { useNavigate } from 'react-router'

import { Logo } from '@/components/brand/Logo'
import { Button } from '@/components/ui/Button'
import { useT } from '@/lib/i18n'

export function ResetPasswordSuccessPage() {
  const t = useT()
  const navigate = useNavigate()

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-md rounded-xl border border-border bg-white p-8 text-center shadow-lg">

        <div className="flex flex-col items-center gap-4">
          <Logo size="md" />

          <div>
            <h1 className="text-h1 font-semibold">
              {t('auth.passwordReset.successTitle')}
            </h1>

            <p className="mt-2 text-body text-text-2">
              {t('auth.passwordReset.successDescription')}
            </p>
          </div>

          <Button
            variant="primary"
            block
            onClick={() =>
              navigate('/dang-nhap')
            }
          >
            {t('auth.passwordReset.backToLogin')}
          </Button>
        </div>
      </div>
    </div>
  )
}
