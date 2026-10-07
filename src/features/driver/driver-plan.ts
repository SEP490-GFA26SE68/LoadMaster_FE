import { lt } from '@/domain/geometry'
import type { ScenePlacement, ViewerSceneModel } from '@/features/viewer3d/scene-input'
import { unloadSequence } from '@/features/viewer3d/operations/unloading'
import type { DeliveryStop, StopKind } from '@/lib/mock-db'
import { NO_PICKUPS, stopPickupItems, type PickupFacts, type PickupItem } from './driver-pickups'

/** Vùng dọc thùng theo tâm kiện: một phần ba sát vách trước, giữa, một phần ba gần cửa sau. */
export type DeliveryArea = 'front' | 'middle' | 'door'
/** Lớp theo chiều cao: trên sàn, tâm thấp hơn nửa chiều cao thùng, còn lại. */
export type DeliveryLayer = 'floor' | 'lower' | 'upper'

export type DeliveryItem = {
  /** `packageInstanceId` */
  readonly id: string
  readonly packageId: string
  readonly name: string
  readonly weightKg: number
  /** `unloadingOrder` của kết quả */
  readonly unloadingOrder: number
  readonly area: DeliveryArea
  readonly layer: DeliveryLayer
}

export type StopDelivery = {
  /** Vị trí trong `Trip.stops` + 1, khớp `deliveryStop` */
  readonly number: number
  readonly name: string
  readonly address: string
  /** Số điện thoại người nhận để gọi (`tel:`, D-46); vắng thì không có nút Gọi. */
  readonly phone?: string
  readonly contactName?: string
  /** Kiện đã xếp của điểm theo phương án (kể cả kiện kho báo thiếu), theo `unloadingOrder` */
  readonly items: readonly DeliveryItem[]
  /** Loại điểm (FE-7-05); vắng là điểm giao. Điểm nhận dọc đường chèn lúc đang chạy không có kiện nào của phương án. */
  readonly kind?: StopKind
  /** Kiện nhận dọc đường của điểm (nhận hoặc giao), ngoài phương án — chưa có vị trí 3D. */
  readonly pickupItems?: readonly PickupItem[]
}

function areaOf(p: ScenePlacement, lengthCm: number): DeliveryArea {
  const center = p.position.x + p.lengthCm / 2
  if (lt(center, lengthCm / 3)) return 'front'
  return lt(center, (lengthCm * 2) / 3) ? 'middle' : 'door'
}

function layerOf(p: ScenePlacement, heightCm: number): DeliveryLayer {
  if (!lt(0, p.position.z)) return 'floor'
  return lt(p.position.z + p.heightCm / 2, heightCm / 2) ? 'lower' : 'upper'
}

/**
 * Điểm giao của chuyến kèm kiện cần dỡ ở từng điểm, thứ tự dỡ lấy từ kết quả (`unloadSequence`), không suy ra. `model` đã đổi số điểm
 * của phương án sang số điểm hiện tại (`adaptResult`), nên chuyến đã chèn điểm nhận vẫn đọc đúng. Kiện nhận dọc đường (`pickups`) đứng
 * riêng ở `pickupItems`.
 */
export function stopDeliveries(stops: readonly DeliveryStop[], model: Pick<ViewerSceneModel, 'placements' | 'vehicle'>, pickups: PickupFacts = NO_PICKUPS): StopDelivery[] {
  const { innerLengthCm, innerHeightCm } = model.vehicle
  return stops.map((stop, index) => {
    const number = index + 1
    const items = unloadSequence(model.placements.filter((p) => p.stop === number)).ordered.map((p): DeliveryItem => ({
      id: p.id,
      packageId: p.packageId,
      name: p.name,
      weightKg: p.weightKg,
      unloadingOrder: p.unloadingOrder,
      area: areaOf(p, innerLengthCm),
      layer: layerOf(p, innerHeightCm),
    }))
    return { number, name: stop.name, address: stop.address, phone: stop.phone, contactName: stop.contactName, items, kind: stop.kind ?? 'DELIVERY', pickupItems: stopPickupItems(stop.id, pickups) }
  })
}
