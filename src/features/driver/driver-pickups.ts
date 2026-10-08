import type { UnplacedPackage } from '@/domain/models'
import type { PickupSceneItem } from '@/features/viewer3d/scene-pickups'
import type { DeliveryStop, Package, PickupRequest } from '@/lib/mock-db'

/**
 * Kiện nhận dọc đường của một điểm trên màn tài xế (FE-7-05, D-88). Kiện nhận không nằm trong phương án đã duyệt: màn liệt kê chúng riêng
 * ("Kiện nhận dọc đường"), mã kiện kho kiện (`PK-NNNN`) là mã đối chiếu. Chỗ của chúng trên xe nằm cùng yêu cầu (`layout`, FE-BL-01):
 * kiện có chỗ được vẽ trong khung 3D (`pickupSceneItems`), kiện chưa có chỗ nêu lý do (`unplacedPickups`).
 *
 * Vai trò tại một điểm suy từ yêu cầu của kiện, cùng luật với kho (`pickupRoleAt` của `db-pickup-progress.ts`): `pick` — điểm là điểm nhận
 * và yêu cầu còn `APPROVED`, tài xế đối chiếu kiện lên xe; `deliver` — điểm là điểm giao và yêu cầu đã `LOADED`, tài xế dỡ như kiện thường.
 */
export type PickupItem = {
  /** Mã kiện kho kiện — cũng là `packageInstanceId` mọi lần đối chiếu của kiện. */
  readonly id: string
  /** Mã của bên gửi. */
  readonly name: string
  readonly weightKg: number
  readonly requestId: string
  readonly role: 'pick' | 'deliver'
}

/** Dữ liệu kiện nhận của chuyến mà màn tài xế đọc: yêu cầu đã duyệt và kiện kho kiện của chúng. */
export type PickupFacts = { readonly requests: readonly PickupRequest[]; readonly packages: readonly Package[] }

export const NO_PICKUPS: PickupFacts = { requests: [], packages: [] }

/** Kiện nhận phải xử lý ở điểm `stopId`, theo thứ tự yêu cầu rồi thứ tự kiện. */
export function stopPickupItems(stopId: string, { requests, packages }: PickupFacts): PickupItem[] {
  const byId = new Map(packages.map((pkg) => [pkg.id, pkg]))
  return requests.flatMap((request) => {
    const role = request.status === 'APPROVED' && request.pickupStopId === stopId ? 'pick' : request.status === 'LOADED' && request.deliveryStopId === stopId ? 'deliver' : undefined
    if (role === undefined) return []
    return (request.packageIds ?? []).flatMap((id) => {
      const pkg = byId.get(id)
      return pkg === undefined ? [] : [{ id, name: pkg.packageCode, weightKg: pkg.weightKg, requestId: request.id, role }]
    })
  })
}

/** Yêu cầu còn kiện đi cùng xe hoặc sắp lên xe: đã duyệt, chưa giao xong. */
const onTheRoad = (request: PickupRequest) => request.status === 'APPROVED' || request.status === 'LOADED'

/**
 * Kiện nhận đã có chỗ trên xe, cho khung 3D: kiện thứ i của yêu cầu ứng với chỗ có `packageIndex` i. `stops` là điểm của chuyến lúc này —
 * số điểm giao trong scene là số hiện tại của `request.deliveryStopId`.
 */
export function pickupSceneItems(stops: readonly Pick<DeliveryStop, 'id'>[], { requests, packages }: PickupFacts): PickupSceneItem[] {
  const byId = new Map(packages.map((pkg) => [pkg.id, pkg]))
  return requests.filter(onTheRoad).flatMap((request) => {
    const stop = stops.findIndex((item) => item.id === request.deliveryStopId) + 1
    if (stop === 0) return []
    return (request.layout?.placements ?? []).flatMap((spot): PickupSceneItem[] => {
      const pkg = byId.get(request.packageIds?.[spot.packageIndex] ?? '')
      if (pkg === undefined) return []
      return [{
        id: pkg.id, name: pkg.packageCode, stop, weightKg: pkg.weightKg, handlingClass: pkg.handlingClass,
        base: { lengthCm: pkg.lengthCm, widthCm: pkg.widthCm, heightCm: pkg.heightCm }, spot,
      }]
    })
  })
}

/** Kiện nhận chưa có chỗ trên xe (không vừa vùng trống): tài xế đọc lý do và xếp theo hướng dẫn của điều phối viên. */
export type UnplacedPickup = { readonly id: string; readonly name: string; readonly weightKg: number; readonly reasonCode: UnplacedPackage['reasonCode'] }

export function unplacedPickups({ requests, packages }: PickupFacts): UnplacedPickup[] {
  const byId = new Map(packages.map((pkg) => [pkg.id, pkg]))
  return requests.filter(onTheRoad).flatMap((request) =>
    (request.layout?.unplaced ?? []).flatMap(({ packageIndex, reasonCode }): UnplacedPickup[] => {
      const pkg = byId.get(request.packageIds?.[packageIndex] ?? '')
      return pkg === undefined || pkg.status === 'DELIVERED' ? [] : [{ id: pkg.id, name: pkg.packageCode, weightKg: pkg.weightKg, reasonCode }]
    }),
  )
}
