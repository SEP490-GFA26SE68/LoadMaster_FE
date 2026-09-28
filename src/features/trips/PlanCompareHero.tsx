import { PageHero } from '@/components/PageHero'
import { StatusBadge, TripSubStatusTag } from '@/components/StatusBadge'
import { useT } from '@/lib/i18n'
import type { TripDetail } from './trips-api'

/**
 * Dải trời của So sánh phương án (V2.3 `SoSanhPhuongAn.jpg`, LM-106): đường dẫn "Chuyến hàng / mã / So sánh phương án", tiêu đề và
 * chip trạng thái chuyến, dòng dữ liệu tên tuyến · số phương án đã lưu · xe (biển số mono). Card ma trận / trạng thái rỗng đè lên đáy
 * dải (`overlap`).
 */
export function PlanCompareHero({ tripId, detail, revisionCount }: {
  tripId: string
  detail: TripDetail | undefined
  revisionCount: number | undefined
}) {
  const t = useT()
  const title = t('trips.compare.title')
  return (
    <PageHero
      overlap
      crumbs={[
        { label: t('trips.list.title'), to: '/chuyen' },
        { label: tripId, to: `/chuyen/${tripId}`, mono: true },
        { label: title },
      ]}
      title={title}
      badge={detail ? (
        <span className="flex items-center gap-2">
          <StatusBadge status={detail.status} />
          <TripSubStatusTag sub={detail.sub} />
        </span>
      ) : undefined}
      description={detail && revisionCount !== undefined ? <CompareMeta detail={detail} revisionCount={revisionCount} /> : undefined}
    />
  )
}

/** "Tuyến Q.7 – … · 3 phương án đã lưu · Hyundai HD210 60C-446.32" — tên xe trong kho là "tên · biển số", biển số mono. */
function CompareMeta({ detail, revisionCount }: { detail: TripDetail; revisionCount: number }) {
  const t = useT()
  const { trip, vehicle } = detail
  const cut = vehicle.name.lastIndexOf(' · ')
  return (
    <span className="inline-flex min-w-0 items-baseline gap-3">
      <span>{trip.name}</span>
      <span aria-hidden>·</span>
      <span>{t('trips.compare.subtitle', { count: revisionCount })}</span>
      <span aria-hidden>·</span>
      <span>
        {cut === -1 ? vehicle.name : <>{vehicle.name.slice(0, cut)} <span className="font-mono text-caption text-cyan-200">{vehicle.name.slice(cut + 3)}</span></>}
      </span>
    </span>
  )
}
