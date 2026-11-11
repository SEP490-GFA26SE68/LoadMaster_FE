import { Clock, LogOut, ShieldAlert } from 'lucide-react'
import { LanguageMenu } from '@/components/LanguageMenu'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useAuthSafe } from '@/features/auth/AuthProvider'

/**
 * Màn hình khóa thay thế toàn bộ ứng dụng dành cho các vai trò nhân viên
 * (Company Manager, Dispatcher, Driver, Warehouse) khi gói cước dùng thử của Doanh nghiệp đã hết hạn.
 */
export function TrialExpiredLockedView() {
  const auth = useAuthSafe()
  const user = auth?.user

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-ink-1">
      {/* Top bar */}
      <header className="flex h-16 items-center justify-between border-b border-border bg-surface px-6 shadow-xs">
        <div className="flex items-center gap-3">
          <span className="font-display text-h3 font-bold tracking-tight text-primary">LoadMaster</span>
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-caption font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
            Gói cước hết hạn
          </span>
        </div>
        <div className="flex items-center gap-3">
          <LanguageMenu />
          {user?.email ? (
            <span className="hidden text-caption text-ink-3 sm:inline">{user.email}</span>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => auth?.signOut?.()}
            className="text-ink-2 hover:text-ink-1"
          >
            <LogOut className="mr-1.5 h-4 w-4" />
            Đăng xuất
          </Button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex flex-1 items-center justify-center p-4 sm:p-6 md:p-8">
        <div className="w-full max-w-xl space-y-6">
          <Card className="border-amber-200 bg-amber-50/40 p-6 text-center shadow-md dark:border-amber-900/50 dark:bg-amber-950/20 sm:p-8">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 shadow-inner dark:bg-amber-900/50 dark:text-amber-400">
              <ShieldAlert className="size-8" strokeWidth={1.75} />
            </div>

            <h1 className="font-display text-h3 font-bold text-ink-1 sm:text-h2">
              Gói cước dùng thử của doanh nghiệp đã hết hạn
            </h1>

            <p className="mt-3 text-body text-ink-2">
              Thời gian dùng thử tiêu chuẩn (14 ngày) dành cho Doanh nghiệp của bạn trên hệ thống LoadMaster đã kết thúc.
              Toàn bộ tính năng vận hành (quản lý chuyến xe, điều phối, kho bãi và tối ưu xếp dỡ) hiện đang tạm dừng.
            </p>

            <div className="mt-6 rounded-xl border border-border/80 bg-surface/90 p-4 text-left shadow-xs">
              <div className="flex items-start gap-3">
                <Clock className="mt-0.5 size-5 flex-none text-amber-500" />
                <div className="space-y-1">
                  <p className="text-small font-semibold text-ink-1">
                    Cần tiếp tục sử dụng hệ thống?
                  </p>
                  <p className="text-small text-ink-2">
                    Vui lòng liên hệ với <strong>Quản trị viên doanh nghiệp (Company Admin)</strong> của bạn để thực hiện gia hạn hoặc nâng cấp gói cước trên LoadMaster.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                type="button"
                variant="primary"
                onClick={() => auth?.signOut?.()}
                className="w-full sm:w-auto"
              >
                <LogOut className="mr-2 size-4" />
                Đăng xuất khỏi hệ thống
              </Button>
            </div>
          </Card>
        </div>
      </main>
    </div>
  )
}
