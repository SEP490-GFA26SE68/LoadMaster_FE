import type { ReactNode } from 'react'
import { PageHero } from '@/components/PageHero'
import { StatusBadge } from '@/components/StatusBadge'
import { useFormat, useT } from '@/lib/i18n'
import type { Trip } from '@/lib/mock-db'
import type { TripStatus } from '@/types/trip'
import { useRunDateText } from './trip-form-dates'

/**
 * Khung màn tạo / sửa chuyến trên dải trời V2.3: đường dẫn "Chuyến hàng / Tạo chuyến mới" (sửa: "Chuyến hàng / TRIP-011 / Sửa"), tiêu
 * đề, chip trạng thái và dòng phụ của chuyến đang sửa (tên · ngày chạy · tiến độ xếp), hành động "Huỷ" + nút chính ở phải. Vùng cuộn
 * bắt đầu bằng card nền đặc nên dải trời kéo xuống đè (`overlap`).
 */
export function TripFormShell({ trip, status, actions, children }: {
  /** Chuyến đang sửa; vắng khi tạo mới. `null`: màn sửa chưa có dữ liệu (đang tải, không tìm thấy). */
  trip?: { id: string; data: Trip | null }
  status?: TripStatus
  actions?: ReactNode
  children?: ReactNode
}) {
  const t = useT()
  const crumbs = trip
    ? [
      { label: t('trips.create.crumbTrips'), to: '/chuyen' },
      { label: trip.id, to: `/chuyen/${trip.id}`, mono: true },
      { label: t('trips.create.crumbEdit') },
    ]
    : [{ label: t('trips.create.crumbTrips'), to: '/chuyen' }, { label: t('trips.create.title') }]
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PageHero
        overlap
        title={trip ? t('trips.create.editTitle', { id: trip.id }) : t('trips.create.title')}
        crumbs={crumbs}
        badge={status ? <StatusBadge status={status} /> : undefined}
        description={trip?.data ? <EditSubline trip={trip.data} /> : t('pageHero.tripForm')}
        actions={actions}
      />
      <div className="sky-overlap min-h-0 flex-1 overflow-auto px-shell pb-7">{children}</div>
    </div>
  )
}

/** "Tuyến Tân Bình – Q.1 – Q.7 · Hôm nay, 24/09/2026 · Đã xếp 110 / 280 kiện" — tên và ngày theo chuyến đã lưu; tiến độ từ kho. */
function EditSubline({ trip }: { trip: Trip }) {
  const t = useT()
  const format = useFormat()
  const runDate = useRunDateText()
  const total = trip.packages.reduce((sum, pkg) => sum + pkg.quantity, 0)
  const loaded = trip.loading?.steps.filter((step) => step.outcome === 'loaded').length
  const parts = [trip.name, runDate.withDay(trip.scheduledDate, { relative: true })]
  if (loaded !== undefined) parts.push(t('trips.create.heroLoaded', { loaded: format.integer(loaded), total: format.integer(total) }))
  return <>{parts.filter(Boolean).join('  ·  ')}</>
}
