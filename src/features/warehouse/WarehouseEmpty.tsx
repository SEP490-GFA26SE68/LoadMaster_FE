import type { ReactNode } from 'react'
import { Link } from 'react-router'
import type { LumoPose } from '@/components/brand/Lumo'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/Button'
import { ExitIconButton } from '@/features/auth/ExitControl'
import { useT } from '@/lib/i18n'
import { loadingSessionPath } from './warehouse-trips'

/**
 * Phiên kho không xếp được (LM-060, LM-086): chưa có bản duyệt, bản duyệt lỗi thời chờ duyệt lại, chuyến đã huỷ, hoặc không tải
 * được. Nói rõ lý do và có lối về danh sách chuyến 56px nhìn thấy được (mục 10). Không dựng phương án giả.
 */
export function WarehouseEmpty({ tripId, mascot = 'warehouseWaiting', title, description, action }: {
  tripId: string
  /** Lumo (LM-105): chờ việc (mặc định — chưa có bản duyệt, chờ duyệt lại) hoặc `error` (lỗi tải, chuyến đã huỷ). */
  mascot?: LumoPose
  title: string
  description: string
  /** Mặc định: về danh sách chuyến của kho. */
  action?: ReactNode
}) {
  const t = useT()
  return (
    <div className="flex h-dvh flex-col bg-bg text-body-lg">
      <header className="flex h-18 flex-none items-center border-b border-border pl-3">
        <ExitIconButton screenHome={loadingSessionPath(tripId)} contextual={`/chuyen/${tripId}`} label={t('warehouse.header.exit')} iconClassName="size-7" />
      </header>
      <div className="grid flex-1 place-items-center p-6">
        <EmptyState
          mascot={mascot}
          // Mô tả của EmptyState là 14px; màn kho chạy trên tablet nên nâng mọi chữ lên 16px (mục 10)
          className="w-full max-w-160 [&_span]:text-body-lg"
          title={title}
          description={description}
          action={action ?? (
            <Button asChild variant="primary" size="touch">
              <Link to="/kho">{t('warehouse.backToList')}</Link>
            </Button>
          )}
        />
      </div>
    </div>
  )
}
