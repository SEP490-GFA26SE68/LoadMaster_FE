import { CheckCircle2, FileText, Mail, LogIn, ArrowRight } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { PublicFooter } from '@/features/marketing/PublicFooter'
import { PublicHeader } from '@/features/marketing/PublicHeader'
import { useT } from '@/lib/i18n'

export function RegistrationSuccessPage() {
  const t = useT()
  const [params] = useSearchParams()
  const orderCode = params.get('vnp_TxnRef') || params.get('orderCode')

  return (
    <div className="flex min-h-screen flex-col bg-bg-canvas text-ink-strong">
      <PublicHeader />

      <main className="flex-1 px-4 py-12 md:py-16">
        <div className="mx-auto max-w-xl">
          <Card className="border-border bg-bg p-6 text-center shadow-sm">
            <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-success/10 text-success">
              <CheckCircle2 className="size-12" />
            </div>

            <CardHeader className="p-0 mt-5">
              <CardTitle as="h2" className="text-h1 font-bold text-ink-strong">
                {t('guestRegistration.success.title')}
              </CardTitle>
              <p className="text-body text-ink-2 mt-2">
                {t('guestRegistration.success.description')}
              </p>
            </CardHeader>

            <div className="mt-6 flex flex-col gap-4 text-left">
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                <div className="flex flex-col gap-2 text-small">
                  <div className="flex items-center gap-2 font-semibold text-primary">
                    <Mail className="size-4" />
                    <span>{t('guestRegistration.success.tempPasswordNotice')}</span>
                  </div>
                  <p className="text-ink-2">
                    {t('guestRegistration.success.checkEmailPrompt')}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-muted/20 p-4">
                <div className="flex items-center gap-2 text-small text-ink-strong">
                  <FileText className="size-4 text-ink-2" />
                  <span>
                    {t('guestRegistration.success.invoiceNotice', { code: orderCode ?? 'LM-SUCCESS' })}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button asChild variant="primary" className="h-12 font-semibold">
                <Link to="/dang-nhap">
                  <LogIn className="mr-2 size-5" />
                  {t('guestRegistration.success.loginNow')}
                </Link>
              </Button>
              <Button asChild variant="secondary" className="h-12">
                <Link to="/gioi-thieu">
                  {t('guestRegistration.success.backHome')}
                  <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
            </div>
          </Card>
        </div>
      </main>

      <PublicFooter />
    </div>
  )
}
