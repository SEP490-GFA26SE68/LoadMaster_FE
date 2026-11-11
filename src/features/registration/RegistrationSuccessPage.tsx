import { ArrowRight, CheckCircle2, FileText, LogIn, Mail } from 'lucide-react'
import { Link, Navigate, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { PUBLIC_HOME } from '@/features/auth/landing'
import { PublicFooter } from '@/features/marketing/PublicFooter'
import { PublicHeader } from '@/features/marketing/PublicHeader'
import { useT } from '@/lib/i18n'
import { REGISTRATION_CAPABILITIES } from './useRegistrationQuery'

/**
 * Trang sau khi tự đăng ký và thanh toán xong `/dang-ky-thanh-cong` (chỉ khi nối backend; kho mẫu chuyển về trang giới thiệu): báo tài
 * khoản đã tạo, mật khẩu tạm gửi qua email, và mã giao dịch khi cổng thanh toán trả về — không có mã thì không có dòng hoá đơn.
 */
export function RegistrationSuccessPage() {
  if (!REGISTRATION_CAPABILITIES.publicSignUp) return <Navigate replace to={PUBLIC_HOME} />
  return <RegistrationSuccess />
}

function RegistrationSuccess() {
  const t = useT()
  const [params] = useSearchParams()
  const orderCode = params.get('vnp_TxnRef') || params.get('orderCode')

  return (
    <div className="flex min-h-screen flex-col bg-app text-ink-strong">
      <PublicHeader />

      <main className="flex-1 px-4 py-12 md:py-16">
        <div className="mx-auto max-w-xl">
          <Card className="p-6 text-center">
            <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-green-50 text-success">
              <CheckCircle2 className="size-12" strokeWidth={1.5} />
            </div>

            <CardHeader className="mt-5 p-0">
              <CardTitle as="h2" className="text-h1 font-bold text-ink-strong">
                {t('guestRegistration.success.title')}
              </CardTitle>
              <p className="mt-2 text-body text-ink-2">
                {t('guestRegistration.success.description')}
              </p>
            </CardHeader>

            <div className="mt-6 flex flex-col gap-4 text-left">
              <div className="rounded-lg border border-cyan-200 bg-primary-bg p-4">
                <div className="flex flex-col gap-2 text-small">
                  <div className="flex items-center gap-2 font-semibold text-primary">
                    <Mail className="size-4" strokeWidth={1.5} />
                    <span>{t('guestRegistration.success.tempPasswordNotice')}</span>
                  </div>
                  <p className="text-ink-2">
                    {t('guestRegistration.success.checkEmailPrompt')}
                  </p>
                </div>
              </div>

              {orderCode ? (
                <div className="rounded-lg border border-border bg-surface p-4">
                  <div className="flex items-center gap-2 text-small text-ink-strong">
                    <FileText className="size-4 text-ink-2" strokeWidth={1.5} />
                    <span>{t('guestRegistration.success.invoiceNotice', { code: orderCode })}</span>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button asChild variant="primary" className="h-12">
                <Link to="/dang-nhap">
                  <LogIn className="size-5" strokeWidth={1.5} />
                  {t('guestRegistration.success.loginNow')}
                </Link>
              </Button>
              <Button asChild variant="secondary" className="h-12">
                <Link to={PUBLIC_HOME}>
                  {t('guestRegistration.success.backHome')}
                  <ArrowRight className="size-4" strokeWidth={1.5} />
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
