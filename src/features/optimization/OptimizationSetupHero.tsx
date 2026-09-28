import { Zap } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { PageHero } from '@/components/PageHero'
import { StatusBadge, TripSubStatusTag } from '@/components/StatusBadge'
import { Button } from '@/components/ui/Button'
import { useRunDateText } from '@/features/trips/trip-form-dates'
import { useT } from '@/lib/i18n'
import type { OptimizationSetup } from './optimization-api'

/**
 * Dải trời của Thiết lập tối ưu (V2.3 `ThietLapToiUu.jpg`, LM-106): đường dẫn "Chuyến hàng / mã / Thiết lập tối ưu", tiêu đề và chip
 * trạng thái chuyến (kèm dòng phụ lỗi thời), dòng dữ liệu của chuyến (tên · ngày chạy · xe · tài xế), nút chính "Tối ưu" ở phải. Nút
 * bị chặn thì lý do nằm ngay trên nút ("Chưa chạy được: 2 lỗi cần sửa ở …", `aria-describedby`). `children`: banner khoá / quyết định
 * của quản lý nằm trong dải, dưới dòng dữ liệu.
 */
export function OptimizationSetupHero({ tripId, setup, disabled, blockedReason, onRun, children }: {
  tripId: string
  setup: OptimizationSetup | undefined
  disabled: boolean
  /** Câu lý do khi nút tắt vì còn lỗi; `null` khi nút tắt vì lý do khác (đang tải, đang chạy, chuyến đã khoá có banner riêng). */
  blockedReason: string | null
  onRun: () => void
  children?: ReactNode
}) {
  const t = useT()
  const hintId = useId()
  return (
    <PageHero
      overlap
      crumbs={[
        { label: t('trips.list.title'), to: '/chuyen' },
        { label: tripId, to: `/chuyen/${tripId}`, mono: true },
        { label: t('optimization.title') },
      ]}
      title={t('optimization.title')}
      badge={setup ? (
        <span className="flex items-center gap-2">
          <StatusBadge status={setup.status} />
          <TripSubStatusTag sub={setup.sub} />
        </span>
      ) : undefined}
      description={setup ? <TripLine setup={setup} /> : undefined}
      actions={
        // Nâng nút lên ngang hàng tiêu đề (PageHero canh hành động theo đáy khối, dưới dòng dữ liệu): toast nằm từ 152 px (LM-101) —
        // nút thấp hơn thì con trỏ vừa bấm Tối ưu nằm trên toast, toast dừng đếm giờ và không tự tắt. Lý do chặn đặt tuyệt đối trên nút
        // để dải trời không cao thêm khi có lỗi.
        <div className="relative md:mb-5">
          {blockedReason ? (
            <p id={hintId} className="absolute right-0 bottom-full mb-2.5 w-max max-w-120 rounded-md border border-sky-glass-border bg-sky-glass px-3 py-1.5 text-small text-sky-text max-md:static max-md:mb-2">
              {blockedReason}
            </p>
          ) : null}
          <Button variant="primary" disabled={disabled} aria-describedby={blockedReason ? hintId : undefined} onClick={onRun}>
            <Zap strokeWidth={1.75} />
            {t('optimization.run')}
          </Button>
        </div>
      }
    >
      {children ? <div className="flex flex-col gap-3 px-5 pt-1 pb-5">{children}</div> : null}
    </PageHero>
  )
}

/** "Tuyến Tân An – Dĩ An · Thứ Bảy, 26/09/2026 · Truck 6m · Chưa gán tài xế" — dữ liệu của chuyến, không phải câu mô tả. */
function TripLine({ setup }: { setup: OptimizationSetup }) {
  const t = useT()
  const runDate = useRunDateText()
  const { trip, vehicle, driverName } = setup
  const parts = [
    trip.name,
    runDate.withDay(trip.scheduledDate) ?? trip.scheduledDate,
    vehicle.name,
    driverName ?? t('trips.detail.noDriver'),
  ]
  return (
    <span className="inline-flex min-w-0 items-baseline gap-3">
      {parts.map((part, index) => (
        <span key={`${part}-${index}`} className="inline-flex items-baseline gap-3">
          {index > 0 ? <span aria-hidden>·</span> : null}
          <span>{part}</span>
        </span>
      ))}
    </span>
  )
}
