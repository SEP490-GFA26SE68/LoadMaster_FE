import type { MouseEvent } from 'react'
import { Link } from 'react-router'
import { Badge, type BadgeDot, type BadgeTone } from '@/components/ui/Badge'
import { tripLinkable } from '@/features/trips/trips-capabilities'
import { useFormat, useT } from '@/lib/i18n'
import type { FleetStatus, FleetVehicleState } from './vehicle-status'

/**
 * Chip trạng thái xe theo ngữ pháp chấm V2.3 (Main.jpg): sẵn sàng chấm xanh lá, đang phục vụ chuyến xanh lam có quầng (đang chạy, cùng
 * tông với chuyến đang xếp / đang giao), bảo dưỡng và ngừng sử dụng (chỉ backend có) chip xám — phân biệt bằng chữ.
 */
const TONE: Record<FleetStatus, { tone: BadgeTone; dot: BadgeDot }> = {
  available: { tone: 'success', dot: 'solid' },
  in_use: { tone: 'azure', dot: 'halo' },
  maintenance: { tone: 'neutral', dot: 'solid' },
  retired: { tone: 'neutral', dot: 'solid' },
}

export function VehicleStatusBadge({ status }: { status: FleetStatus }) {
  const t = useT()
  const spec = TONE[status]
  return <Badge tone={spec.tone} dot={spec.dot}>{t(`fleet.status.${status}`)}</Badge>
}

/** Liên kết trong dòng bảng: không để cú bấm lan lên dòng (dòng cũng mở trang khi bấm). */
function stopRowClick(event: MouseEvent) {
  event.stopPropagation()
}

/**
 * Ô trạng thái ở danh sách đội xe (LM-089, V2.3): chip, dòng dưới là mã chuyến đang phục vụ (liên kết tới chuyến) kèm pha của
 * chuyến, hoặc "Từ <ngày> · <ghi chú bảo dưỡng>" (ghi chú tối đa hai dòng, đủ câu ở `title` và ở trang cấu hình xe). Xe sẵn
 * sàng không có dòng phụ. Mã chuyến chỉ có ở kho mẫu: chuyến đọc backend thì mã là chữ thường (`tripLinkable`).
 */
/** `serverSource`: trạng thái đọc từ máy chủ — mã chuyến là liên kết khi chuyến cũng đọc máy chủ (`tripLinkable`). */
export function VehicleStatusCell({ state, serverSource = false }: { state: FleetVehicleState; serverSource?: boolean }) {
  const t = useT()
  const format = useFormat()
  const maintenance = state.maintenance
  return (
    <span className="flex min-w-0 flex-col items-start gap-1 whitespace-normal">
      <VehicleStatusBadge status={state.status} />
      {state.status === 'in_use' && state.tripId ? (
        <span className="flex flex-wrap items-baseline gap-x-1.5 text-caption text-ink-3">
          {tripLinkable(serverSource) ? (
            <Link
              to={`/chuyen/${state.tripId}`}
              onClick={stopRowClick}
              className="rounded-sm font-mono font-medium text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {state.tripId}
            </Link>
          ) : <span className="font-mono font-medium">{state.tripId}</span>}
          {state.tripPhase === 'loading' || state.tripPhase === 'loaded' || state.tripPhase === 'delivering' ? (
            <span>· {t(`fleet.tripPhase.${state.tripPhase}`)}</span>
          ) : null}
        </span>
      ) : null}
      {state.status === 'maintenance' && maintenance ? (
        <span className="flex items-baseline gap-1 text-caption text-ink-3">
          <span className="flex-none">{t('fleet.maintenanceSince', { date: format.dayMonth(maintenance.since) })} ·</span>
          <span className="line-clamp-2" title={maintenance.note}>{maintenance.note}</span>
        </span>
      ) : null}
    </span>
  )
}
