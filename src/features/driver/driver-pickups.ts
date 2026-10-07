import type { Package, PickupRequest } from '@/lib/mock-db'

/**
 * Kiện nhận dọc đường của một điểm trên màn tài xế (FE-7-05, D-88). Kiện nhận chưa có vị trí 3D (P2) nên không nằm trong phương án đã
 * duyệt: màn liệt kê chúng riêng ("Kiện nhận dọc đường — chưa có vị trí 3D"), mã kiện kho kiện (`PK-NNNN`) là mã đối chiếu.
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
