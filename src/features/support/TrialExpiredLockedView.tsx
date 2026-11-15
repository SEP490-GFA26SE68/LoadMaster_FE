import { Clock, LogOut, RefreshCw, ShieldAlert } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Logo } from '@/components/brand/Logo'
import { LanguageMenu } from '@/components/LanguageMenu'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useAuthSafe } from '@/features/auth/AuthProvider'
import { dataErrorMessage, useT } from '@/lib/i18n'

/**
 * Màn khoá thay cả ứng dụng cho nhân viên công ty (quản lý công ty, điều phối viên, nhân viên kho, tài xế) khi công ty không còn gói
 * cước đang hiệu lực — máy chủ cũng từ chối mọi API của họ (`SUBSCRIPTION_EXPIRED`). Quản trị công ty không vào đây mà chỉ còn `/goi-cuoc`.
 */
export function TrialExpiredLockedView() {
  const t = useT()
  const auth = useAuthSafe()
  const user = auth?.user
  const [checking, setChecking] = useState(false)
  const [stillLocked, setStillLocked] = useState(false)

  /** Quản trị công ty vừa gia hạn: đọc lại hồ sơ; hết khoá thì `AppShell` tự mở lại app, còn khoá thì nói tại chỗ. */
  async function handleRecheck() {
    if (!auth) return
    setChecking(true)
    setStillLocked(false)
    try {
      const fresh = await auth.refreshUser()
      setStillLocked(fresh?.subscriptionExpired === true)
    } catch (error) {
      toast.error(dataErrorMessage(error, t))
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-app text-ink-1">
      <header className="flex h-16 items-center justify-between border-b border-border bg-bg px-6">
        <div className="flex items-center gap-3">
          <Logo size="sm" />
          <Badge tone="warning">{t('support.subscriptionLocked.badge')}</Badge>
        </div>
        <div className="flex items-center gap-3">
          <LanguageMenu />
          {user?.email ? <span className="hidden text-caption text-ink-3 sm:inline">{user.email}</span> : null}
          <Button type="button" variant="ghost" size="sm" onClick={() => void auth?.signOut?.()}>
            <LogOut strokeWidth={1.5} />
            {t('support.subscriptionLocked.signOut')}
          </Button>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center p-4 sm:p-6 md:p-8">
        <Card className="w-full max-w-xl">
          <div className="flex flex-col gap-6 p-6 text-center sm:p-8">
            <div className="mx-auto flex size-14 items-center justify-center rounded-lg bg-tint-amber text-tint-amber-fg">
              <ShieldAlert className="size-8" strokeWidth={1.5} aria-hidden />
            </div>
            <div>
              <h1 className="m-0 font-display text-h2 font-bold text-ink-strong">{t('support.subscriptionLocked.title')}</h1>
              <p className="mt-3 text-body text-ink-2">{t('support.subscriptionLocked.body')}</p>
            </div>
            <div className="flex items-start gap-3 rounded-lg border border-border bg-surface p-4 text-left">
              <Clock className="mt-0.5 size-5 flex-none text-warning" strokeWidth={1.5} aria-hidden />
              <div className="flex flex-col gap-1">
                <p className="m-0 text-small font-semibold text-ink-1">{t('support.subscriptionLocked.nextTitle')}</p>
                <p className="m-0 text-small text-ink-2">{t('support.subscriptionLocked.nextBody')}</p>
              </div>
            </div>
            <div className="flex flex-col-reverse justify-center gap-3 sm:flex-row">
              <Button type="button" variant="secondary" loading={checking} onClick={() => void handleRecheck()} className="w-full sm:w-auto">
                {checking ? null : <RefreshCw strokeWidth={1.5} aria-hidden />}
                {t('support.subscriptionLocked.recheck')}
              </Button>
              <Button type="button" variant="primary" onClick={() => void auth?.signOut?.()} className="w-full sm:w-auto">
                <LogOut strokeWidth={1.5} />
                {t('support.subscriptionLocked.signOutLong')}
              </Button>
            </div>
            <p role="status" className="m-0 text-small text-ink-2 empty:hidden">
              {stillLocked ? t('support.subscriptionLocked.stillLocked') : null}
            </p>
          </div>
        </Card>
      </main>
    </div>
  )
}
