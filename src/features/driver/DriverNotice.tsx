import type { ReactNode } from 'react'
import { Link } from 'react-router'
import type { LumoPose } from '@/components/brand/Lumo'
import { EmptyState } from '@/components/EmptyState'
import { TouchTopBar } from '@/components/TouchTopBar'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
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
    <div className="flex h-dvh flex-col bg-app text-body-lg">
      <TouchTopBar leading={<ExitIconButton tone="sky" screenHome={DRIVER_TRIP_SCREEN} contextual="/tai-xe" label={t('driver.toTrips')} iconClassName="size-7" />} />
      <div className="flex flex-1 flex-col justify-center p-4">
        {/* Lumo trong card trắng (V2.3 đợt 6) */}
        <Card>
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
        </Card>
      </div>
    </div>
  )
}
