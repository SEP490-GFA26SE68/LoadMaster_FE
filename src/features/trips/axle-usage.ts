import { axleLoadsOf } from '@/domain/metrics'
import { gt } from '@/domain/geometry'
import type { VehicleConfig } from '@/domain/models'
import type { LoadPlan } from '@/features/optimization/load-plans-backend-api'

/** Mức dùng một nhóm trục của phương án máy chủ: tải máy chủ trả so với giới hạn của xe. */
export type AxleUsage = {
  readonly group: 'front' | 'rear'
  readonly loadKg: number
  readonly limitKg: number
  /** 0–1, chặn ở 1 để thanh không tràn; vượt thì `overKg` > 0 và màn nói bằng chữ. */
  readonly share: number
  readonly overKg: number
}

/**
 * Thanh tải trục của thẻ phương án: chỉ nhóm có cả tải (máy chủ trả) lẫn giới hạn (xe khai, theo cùng luật của `axleLoadsOf`). Thiếu một
 * trong hai thì không có thanh của nhóm đó — không vẽ thanh rỗng. Thuần.
 */
export function axleUsage(plan: LoadPlan, vehicle: VehicleConfig | undefined): AxleUsage[] {
  if (!vehicle) return []
  const loads = axleLoadsOf(vehicle, { totalKg: 0 })
  if (loads.status !== 'computed') return []
  const groups = [
    { group: 'front' as const, loadKg: plan.frontAxleLoadKg, limitKg: loads.front.limitKg },
    { group: 'rear' as const, loadKg: plan.rearAxleLoadKg, limitKg: loads.rear.limitKg },
  ]
  return groups.flatMap(({ group, loadKg, limitKg }) => {
    if (loadKg === null || limitKg === undefined || !gt(limitKg, 0)) return []
    return [{ group, loadKg, limitKg, share: Math.min(1, Math.max(0, loadKg / limitKg)), overKg: gt(loadKg, limitKg) ? loadKg - limitKg : 0 }]
  })
}
