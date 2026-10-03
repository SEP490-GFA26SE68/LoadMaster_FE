import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { restrictToHorizontalAxis, restrictToParentElement } from '@dnd-kit/modifiers'
import { SortableContext, arrayMove, horizontalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { Clock, Warehouse } from 'lucide-react'
import { toast } from 'sonner'
import type { DeliveryStop } from '@/lib/mock-db'
import { useFormat, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { StopArrow, StopCard, StopLeg, type StopEta, type StopState } from './StopCard'
import type { StopRow } from './trip-summary'

/** Quá 6 điểm giao thì mỗi điểm rộng cố định và khung cuộn ngang; từ 6 trở xuống thì chia đều chiều rộng. */
const SCROLL_AFTER = 6

/**
 * Hàng điểm giao của sơ đồ tuyến (V2.3): kho xuất phát rồi các điểm theo thứ tự giao. Thứ tự là nguồn chuẩn của `deliveryStop`
 * (LM-046): khi sửa được, kéo ngang (chuột hoặc bàn phím, dnd-kit) để đổi, thả xong là lưu qua mutation và kiện được đánh số lại; điểm
 * cuối được xếp sâu nhất trong thùng. Tuyến đã tối ưu (FE-4b-09) thì mỗi điểm thêm giờ đến dự kiến và mức hạn; kéo đổi thứ tự thì kho
 * tính lại giờ đến. `states` có khi chuyến đang giao / đã hoàn thành: đoạn đường nối thay cho mũi tên.
 */
export function StopList({ stops, states, etas, flagMissingCoordinates = false, depotName, departureTime, departedAt, readOnly = true, onReorder, onRemove, selectedStop = null, onSelectStop }: {
  stops: readonly StopRow[]
  states?: readonly StopState[]
  /** Giờ đến và mức hạn theo mã điểm: của tuyến đã tối ưu (FE-4b-09), hoặc tính từ vị trí xe khi chuyến đang chạy (FE-6-09). */
  etas?: ReadonlyMap<string, StopEta>
  /** Chuyến còn lập kế hoạch: gắn nhãn cho điểm chưa có toạ độ. */
  flagMissingCoordinates?: boolean
  /** Tên kho xuất phát của chuyến (FE-4b-04). */
  depotName?: string
  /** Giờ xuất phát theo kế hoạch `HH:mm` (giờ Việt Nam) — hiện khi xe chưa rời kho. */
  departureTime?: string
  /** Giờ xe rời kho, khi chuyến đã bắt đầu giao. */
  departedAt?: string
  readOnly?: boolean
  onReorder?: (stops: readonly DeliveryStop[]) => void
  onRemove?: (stop: StopRow) => void
  /** Số điểm đang lọc bảng kiện; bấm điểm đang lọc thì bỏ lọc (`null`). Lọc được cả khi chỉ xem. */
  selectedStop?: number | null
  onSelectStop?: (stopNumber: number | null) => void
}) {
  const t = useT()
  const format = useFormat()
  const wide = stops.length > SCROLL_AFTER
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id || !onReorder) return
    const from = stops.findIndex((stop) => stop.id === active.id)
    const to = stops.findIndex((stop) => stop.id === over.id)
    if (from === -1 || to === -1) return
    // Bỏ các trường tính từ kiện, giữ nguyên dữ liệu điểm giao (số điện thoại, người liên hệ — D-46; toạ độ, hạn, ưu tiên — D-73)
    onReorder(arrayMove([...stops], from, to).map(({ number: _number, packageCount: _count, weightKg: _weight, ...stop }) => stop))
    toast.success(t('trips.stops.reordered'))
  }

  return (
    <div className="overflow-x-auto">
      <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToHorizontalAxis, restrictToParentElement]} onDragEnd={handleDragEnd}>
        <SortableContext items={stops.map((stop) => stop.id)} strategy={horizontalListSortingStrategy}>
          <ol aria-label={t('trips.route.label', { count: stops.length })} className={cn('m-0 flex list-none items-stretch p-3', wide ? 'w-max' : 'w-full')}>
            <li className={cn('flex flex-none gap-2.5 py-2 pr-4 pl-2', states ? 'items-start' : 'items-center border-r border-dashed border-border')}>
              <span aria-hidden className="grid size-7 flex-none place-items-center rounded-sm bg-n-50 text-ink-2 ring-1 ring-border ring-inset">
                <Warehouse className="size-4" strokeWidth={1.5} />
              </span>
              <span className="flex flex-col gap-1">
                <span className="font-display text-body leading-7 font-[650] whitespace-nowrap text-ink-strong font-stretch-105%">{t('trips.route.depot')}</span>
                {depotName ? <span className="-mt-1.5 max-w-48 truncate text-fine text-ink-3" title={depotName}>{depotName}</span> : null}
                {departedAt ? (
                  <span className="flex items-center gap-1.5 text-small whitespace-nowrap text-ink-2">
                    <Clock aria-hidden className="size-3.5 text-ink-3" strokeWidth={1.75} />
                    {t('trips.route.departed', { time: format.time(departedAt) })}
                  </span>
                ) : departureTime ? (
                  <span className="flex items-center gap-1.5 text-small whitespace-nowrap text-ink-2">
                    <Clock aria-hidden className="size-3.5 text-ink-3" strokeWidth={1.75} />
                    <span className="tabular-nums">{t('trips.route.plannedDeparture', { time: departureTime })}</span>
                  </span>
                ) : null}
              </span>
            </li>
            {stops.map((stop, index) => {
              const state = states?.[index]
              return (
                <StopCard
                  key={stop.id}
                  stop={stop}
                  total={stops.length}
                  wide={wide}
                  state={state}
                  eta={etas?.get(stop.id)}
                  missingCoordinates={flagMissingCoordinates && (stop.lat === undefined || stop.lng === undefined)}
                  lead={state ? <StopLeg state={state} /> : index > 0 ? <StopArrow /> : <span aria-hidden className="w-2 flex-none" />}
                  readOnly={readOnly}
                  selected={selectedStop === stop.number}
                  onSelect={onSelectStop ? () => onSelectStop(selectedStop === stop.number ? null : stop.number) : undefined}
                  onRemove={onRemove ? () => onRemove(stop) : undefined}
                />
              )
            })}
          </ol>
        </SortableContext>
      </DndContext>
    </div>
  )
}
