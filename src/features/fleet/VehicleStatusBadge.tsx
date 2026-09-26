import { Truck } from 'lucide-react'
import type { MouseEvent } from 'react'
import { Link } from 'react-router'
import { Badge, type BadgeDot, type BadgeTone } from '@/components/ui/Badge'
import { useT } from '@/lib/i18n'
import type { VehicleState, VehicleStatus } from '@/lib/mock-db'

/**
 * Chip trạng thái xe theo ngữ pháp chấm V2.3 (Main.jpg): sẵn sàng chấm xanh lá, đang phục vụ chuyến tím có quầng (đang chạy, cùng
 * tông với chuyến đang xếp / đang giao), bảo dưỡng chip xám.
 */
const TONE: Record<VehicleStatus, { tone: BadgeTone; dot: BadgeDot }> = {
  available: { tone: 'success', dot: 'solid' },
  in_use: { tone: 'violet', dot: 'halo' },
  maintenance: { tone: 'neutral', dot: 'solid' },
}

/** Tint của icon xe đầu dòng — cùng nghĩa với ô số liệu của trạng thái đó (AGENTS mục 4). */
const THUMB: Record<VehicleStatus, string> = {
  available: 'bg-tint-green text-tint-green-fg',
  in_use: 'bg-tint-blue text-tint-blue-fg',
  maintenance: 'bg-tint-amber text-tint-amber-fg',
}

export function VehicleStatusBadge({ status }: { status: VehicleStatus }) {
  const t = useT()
  const spec = TONE[status]
  return <Badge tone={spec.tone} dot={spec.dot}>{t(`fleet.status.${status}`)}</Badge>
}

/** Icon xe đầu dòng bảng đội xe, tô theo trạng thái. Trang trí: trạng thái đã có chữ ở cột Trạng thái. */
export function VehicleThumb({ status }: { status: VehicleStatus }) {
  return (
    <span aria-hidden className={`grid size-9 flex-none place-items-center rounded-lg ${THUMB[status]}`}>
      <Truck className="size-5" strokeWidth={1.5} />
    </span>
  )
}

/** Liên kết trong dòng bảng: không để cú bấm lan lên dòng (dòng cũng mở trang khi bấm). */
function stopRowClick(event: MouseEvent) {
  event.stopPropagation()
}

/**
 * Ô trạng thái ở danh sách đội xe (LM-089, V2): badge, dòng dưới là mã chuyến đang phục vụ (liên kết tới chuyến) hoặc ghi chú
 * bảo dưỡng (tối đa hai dòng, đủ câu ở `title` và ở trang cấu hình xe). Xe sẵn sàng không có dòng phụ.
 */
export function VehicleStatusCell({ state }: { state: VehicleState }) {
  const note = state.maintenance?.note
  return (
    <span className="flex min-w-0 flex-col items-start gap-1 whitespace-normal">
      <VehicleStatusBadge status={state.status} />
      {state.status === 'in_use' && state.tripId ? (
        <Link
          to={`/chuyen/${state.tripId}`}
          onClick={stopRowClick}
          className="rounded-sm font-mono text-caption font-medium text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {state.tripId}
        </Link>
      ) : null}
      {state.status === 'maintenance' && note ? (
        <span className="line-clamp-2 text-caption text-ink-3" title={note}>{note}</span>
      ) : null}
    </span>
  )
}
