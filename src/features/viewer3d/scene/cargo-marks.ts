import { UPRIGHT_ORIENTATIONS, type OrientationCode } from '@/domain/geometry'
import type { Packaging } from '../viewer-types'

/**
 * Ô của atlas bề mặt kiện (`cargo-surface.ts`) cho một kiện, đọc thẳng từ dữ liệu của kiện. Giá trị = ô nền (0 carton, 1 pallet,
 * 2 thùng gỗ) + 3 × dấu, dấu = 1 dễ vỡ (`fragile`) · 2 giữ chiều đứng · 3 cả hai. "Giữ chiều đứng" chỉ khi kiện có `keepUpright` **và**
 * hướng đặt giữ chiều cao danh nghĩa thẳng đứng (`UPRIGHT_ORIENTATIONS`: `LWH`, `WLH`): khi đó mũi tên trên mặt bên chỉ đúng lên theo trục cao của kiện đã xoay.
 */
export const SURFACE_BASE: Readonly<Record<Packaging, number>> = { carton: 0, pallet: 1, crate: 2 }

export type MarkedCargo = { readonly packaging: Packaging; readonly fragile: boolean; readonly keepUpright?: boolean; readonly orientation: OrientationCode }

export function standsUpright(orientation: OrientationCode): boolean {
  return UPRIGHT_ORIENTATIONS.includes(orientation)
}

export function cargoSurfaceIndex({ packaging, fragile, keepUpright = false, orientation }: MarkedCargo): number {
  const mark = (fragile ? 1 : 0) + (keepUpright && standsUpright(orientation) ? 2 : 0)
  return SURFACE_BASE[packaging] + 3 * mark
}
