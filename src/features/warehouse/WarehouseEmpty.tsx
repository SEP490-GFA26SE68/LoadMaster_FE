import type { ReactNode } from 'react'
import { Link } from 'react-router'
import type { LumoPose } from '@/components/brand/Lumo'
import { EmptyState } from '@/components/EmptyState'
import { TripSubStatusTag } from '@/components/StatusBadge'
import { TouchTopBar } from '@/components/TouchTopBar'
import { VehicleName } from '@/components/VehicleName'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ExitIconButton } from '@/features/auth/ExitControl'
import { calendarDate } from '@/lib/calendar-date'
import { useFormat, useT } from '@/lib/i18n'
import { useWarehouseTripsQuery } from './useWarehouseQueries'
import { loadingSessionPath } from './warehouse-trips'

/**
 * Phiên kho không xếp được (LM-060, LM-086): chưa có bản duyệt, bản duyệt lỗi thời chờ duyệt lại, chuyến đã huỷ, hoặc không tải
 * được. Nói rõ lý do và có lối về danh sách chuyến 56px nhìn thấy được (mục 10). Không dựng phương án giả. V2.3 đợt 6
 * (`KhoChoDuyetLai.jpg`): thanh dải trời với mã chuyến, Lumo nằm trong card trắng. `showTrip`: chuyến chờ duyệt lại kèm hàng thông tin
 * (tuyến · ngày · xe · số kiện) và dòng phụ ở thanh — đọc từ danh sách chuyến của kho nếu có chuyến đó, không thì bỏ qua.
 */
export function WarehouseEmpty({ tripId, mascot = 'warehouseWaiting', title, description, action, showTrip = false }: {
  tripId: string
  /** Lumo (LM-105): chờ việc (mặc định — chưa có bản duyệt, chờ duyệt lại) hoặc `error` (lỗi tải, chuyến đã huỷ). */
  mascot?: LumoPose
  title: string
  description: string
  /** Mặc định: về danh sách chuyến của kho. */
  action?: ReactNode
  showTrip?: boolean
}) {
  const t = useT()
  return (
    <div className="flex h-dvh flex-col bg-app text-body-lg">
      <TouchTopBar leading={<ExitIconButton tone="sky" screenHome={loadingSessionPath(tripId)} contextual={`/chuyen/${tripId}`} label={t('warehouse.header.exit')} iconClassName="size-7" />}>
        <span className="min-w-0 truncate font-mono text-[18px] leading-6 font-semibold text-sky-text">{tripId}</span>
        {showTrip ? <TripBarTag tripId={tripId} /> : null}
      </TouchTopBar>
      <main className="grid min-h-0 flex-1 place-items-center overflow-y-auto p-4 sm:p-6">
        <Card className="w-full max-w-200">
          <EmptyState
            mascot={mascot}
            // Mô tả của EmptyState là 14px; màn kho chạy trên tablet nên nâng mọi chữ lên 16px (mục 10)
            className="[&_span+span]:text-body-lg"
            title={title}
            description={description}
            action={
              <>
                {showTrip ? <TripInfo tripId={tripId} /> : null}
                {action ?? (
                  <Button asChild variant="primary" size="touch">
                    <Link to="/kho">{t('warehouse.backToList')}</Link>
                  </Button>
                )}
              </>
            }
          />
        </Card>
      </main>
    </div>
  )
}

/** Dòng phụ của chuyến ở thanh trên, đọc từ danh sách chuyến của kho; chuyến không có trong danh sách thì không vẽ gì. */
function TripBarTag({ tripId }: { tripId: string }) {
  const row = useWarehouseTripsQuery().data?.find((entry) => entry.id === tripId)
  return row ? <TripSubStatusTag sub={row.sub} className="h-8 flex-none px-3 text-body-lg" /> : null
}

/** Hàng thông tin chuyến: tuyến · ngày chạy · xe · số kiện. */
function TripInfo({ tripId }: { tripId: string }) {
  const t = useT()
  const format = useFormat()
  const row = useWarehouseTripsQuery().data?.find((entry) => entry.id === tripId)
  if (!row) return null
  return (
    <div className="flex max-w-full flex-wrap items-center justify-center gap-x-5 gap-y-2 rounded-lg border border-line-soft bg-surface px-4 py-3 text-body-lg">
      <span className="font-semibold text-ink-strong">{row.name}</span>
      <Fact label={t('warehouse.list.date')}>{format.date(calendarDate(row.scheduledDate))}</Fact>
      <Fact label={t('warehouse.list.vehicle')}><VehicleName name={row.vehicleName} /></Fact>
      <Fact label={t('warehouse.list.packages')}>{format.integer(row.total)}</Fact>
    </div>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-ink-3">{label}</span>
      <span className="font-semibold text-ink-strong">{children}</span>
    </div>
  )
}
