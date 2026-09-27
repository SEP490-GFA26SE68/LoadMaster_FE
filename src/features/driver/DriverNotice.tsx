import type { ReactNode } from 'react'
import { Link } from 'react-router'
import type { LumoPose } from '@/components/brand/Lumo'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/Button'
import { ExitIconButton } from '@/features/auth/ExitControl'
import { useT } from '@/lib/i18n'
import { DRIVER_TRIP_SCREEN } from './DriverStopHeader'

/**
 * Chuyến mở bằng URL mà không giao được (LM-087): chưa có bản duyệt, đã huỷ, không phải chuyến của tài xế này, hoặc không tải được.
 * Nói rõ lý do, có lối về danh sách chuyến 56px nhìn thấy được (mục 10). Không dựng phương án giả.
 */
/** `mascot` (LM-105): tài xế chờ việc (mặc định) hoặc `error` (lỗi tải, chuyến đã huỷ). */
export function DriverNotice({ mascot = 'driverWaiting', title, description, action }: {
  mascot?: LumoPose
  title: string
  description: string
  action?: ReactNode
}) {
  const t = useT()
  return (
    <div className="flex h-dvh flex-col bg-bg text-body-lg">
      <header className="flex flex-none items-center border-b border-border bg-bg px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-3">
        <ExitIconButton screenHome={DRIVER_TRIP_SCREEN} contextual="/tai-xe" label={t('driver.toTrips')} className="-ml-2" iconClassName="size-6" />
      </header>
      <div className="flex flex-1 flex-col justify-center p-4">
        <EmptyState
          mascot={mascot}
          // Mô tả của EmptyState là 14px; màn tài xế chạy trên điện thoại nên nâng mọi chữ lên 16px (mục 10)
          className="[&_span]:text-body-lg"
          title={title}
          description={description}
          action={action ?? (
            <Button asChild variant="primary" size="touch">
              <Link to="/tai-xe">{t('driver.toTrips')}</Link>
            </Button>
          )}
        />
      </div>
    </div>
  )
}
