import { expandPackages } from '@/domain/cargo'
import type { ConstraintIssue } from '@/domain/constraints'
import { gt, roundKg } from '@/domain/geometry'
import type { CargoPackage, PackagePlacement, VehicleConfig } from '@/domain/models'
import { cargoMass } from './center-of-gravity'

export type AxleGroup = 'front' | 'rear'

export type AxleGroupLoad = {
  /** Vị trí của nhóm theo trục X của thùng, cm (vách trước = 0, âm là dưới cabin); nhóm sau là trung bình vị trí các trục của nhóm. */
  positionXCm: number
  /** Tải của nhóm khi xe chưa có hàng: tổng `emptyLoadKg` các trục của nhóm. */
  emptyLoadKg: number
  /** Phần khối lượng hàng dồn lên nhóm; âm khi trọng tâm hàng nằm ngoài khoảng hai nhóm trục và nhấc bớt tải khỏi nhóm này. */
  cargoLoadKg: number
  loadKg: number
  /** Giới hạn của nhóm; vắng khi loại xe lẫn các trục của nhóm đều không khai giới hạn lớn hơn 0. */
  limitKg?: number
}

/** Vì sao không tính được tải trục: xe chưa khai trục, chỉ có một trục, hoặc các trục cùng một vị trí (không có tay đòn). */
export const AXLE_LOAD_UNAVAILABLE_REASONS = ['NO_AXLES', 'SINGLE_AXLE', 'AXLES_COINCIDE'] as const
export type AxleLoadUnavailableReason = (typeof AXLE_LOAD_UNAVAILABLE_REASONS)[number]

export type AxleLoads =
  | { status: 'computed'; front: AxleGroupLoad; rear: AxleGroupLoad }
  | { status: 'unavailable'; reason: AxleLoadUnavailableReason }

type AxleVehicle = Pick<VehicleConfig, 'axles' | 'frontAxleLimitKg' | 'rearAxleLimitKg'>

/** Giới hạn có nghĩa là số lớn hơn 0: trục khai tải tối đa 0 kg (dòng mới của form xe) là chưa khai giới hạn. */
function declared(limitKg: number | undefined): number | undefined {
  return limitKg !== undefined && gt(limitKg, 0) ? limitKg : undefined
}

/**
 * Tải trục trước / sau theo mô hình đòn bẩy (D-78) khi đã biết khối hàng: tổng khối lượng (kg) và hoành độ trọng tâm (cm).
 * - Nhóm trước là trục có `positionXCm` nhỏ nhất (trục đầu, như `truckLayout` vẽ cầu dẫn hướng); nhóm sau là các trục còn lại, đặt tại
 *   trung bình vị trí của chúng.
 * - Hàng nặng W có trọng tâm tại x: nhóm sau nhận W × (x − x_trước) / (x_sau − x_trước), nhóm trước nhận phần còn lại; cộng tải rỗng.
 * - Giới hạn lấy `frontAxleLimitKg` / `rearAxleLimitKg` của xe (kho điền từ loại xe); vắng thì tổng `maxLoadKg` các trục của nhóm.
 * Số trả về chưa làm tròn. Đây là ước lượng của mock, không tính cabin, nhiên liệu hay người lái ngoài `emptyLoadKg` đã khai.
 */
export function axleLoadsOf(vehicle: AxleVehicle, cargo: { totalKg: number; centerXCm?: number }): AxleLoads {
  const axles = (vehicle.axles ?? []).toSorted((a, b) => a.positionXCm - b.positionXCm)
  const [first, ...rest] = axles
  if (first === undefined) return { status: 'unavailable', reason: 'NO_AXLES' }
  if (rest.length === 0) return { status: 'unavailable', reason: 'SINGLE_AXLE' }
  const rearXCm = rest.reduce((sum, axle) => sum + axle.positionXCm, 0) / rest.length
  const wheelbaseCm = rearXCm - first.positionXCm
  if (!gt(wheelbaseCm, 0)) return { status: 'unavailable', reason: 'AXLES_COINCIDE' }

  const rearCargoKg = cargo.centerXCm === undefined ? 0 : (cargo.totalKg * (cargo.centerXCm - first.positionXCm)) / wheelbaseCm
  const frontCargoKg = cargo.centerXCm === undefined ? 0 : cargo.totalKg - rearCargoKg
  const rearEmptyKg = rest.reduce((sum, axle) => sum + axle.emptyLoadKg, 0)
  const frontLimitKg = declared(vehicle.frontAxleLimitKg) ?? declared(first.maxLoadKg)
  const rearLimitKg = declared(vehicle.rearAxleLimitKg) ?? declared(rest.reduce((sum, axle) => sum + axle.maxLoadKg, 0))
  return {
    status: 'computed',
    front: {
      positionXCm: first.positionXCm,
      emptyLoadKg: first.emptyLoadKg,
      cargoLoadKg: frontCargoKg,
      loadKg: first.emptyLoadKg + frontCargoKg,
      ...(frontLimitKg === undefined ? {} : { limitKg: frontLimitKg }),
    },
    rear: {
      positionXCm: rearXCm,
      emptyLoadKg: rearEmptyKg,
      cargoLoadKg: rearCargoKg,
      loadKg: rearEmptyKg + rearCargoKg,
      ...(rearLimitKg === undefined ? {} : { limitKg: rearLimitKg }),
    },
  }
}

/**
 * Tải trục của một phương án: khối lượng từng placement lấy từ kiện gốc (`expandPackages`), trọng tâm hàng theo Spec 7.9.
 * Placement không thuộc kiện nào của `packages` là lỗi lập trình, không coi là 0 kg.
 */
export function axleLoads(vehicle: AxleVehicle, placements: readonly PackagePlacement[], packages: readonly CargoPackage[]): AxleLoads {
  const weights = new Map(expandPackages(packages).instances.map((instance) => [instance.packageInstanceId, instance.weightKg]))
  const mass = cargoMass(placements, ({ packageInstanceId }) => {
    const weightKg = weights.get(packageInstanceId)
    if (weightKg === undefined) throw new Error(`Không có khối lượng cho placement ${packageInstanceId}`)
    return weightKg
  })
  return axleLoadsOf(vehicle, { totalKg: mass.totalKg, centerXCm: mass.center?.x })
}

/**
 * `AXLE_OVERLOAD` (lỗi — chặn Duyệt, D-78) cho từng nhóm trục có giới hạn mà tải vượt giới hạn qua EPSILON; đúng bằng giới hạn thì
 * không báo. So sánh trên số chưa làm tròn, `params` làm tròn 0,01 kg để hiển thị. Không tính được tải trục thì không có issue.
 */
export function checkAxleLoads(loads: AxleLoads): ConstraintIssue<'AXLE_OVERLOAD'>[] {
  if (loads.status !== 'computed') return []
  const groups: readonly AxleGroup[] = ['front', 'rear']
  return groups.flatMap((group): ConstraintIssue<'AXLE_OVERLOAD'>[] => {
    const { loadKg, limitKg } = loads[group]
    if (limitKg === undefined || !gt(loadKg, limitKg)) return []
    return [{
      code: 'AXLE_OVERLOAD',
      severity: 'error',
      params: { group, loadKg: roundKg(loadKg), limitKg: roundKg(limitKg), overKg: roundKg(loadKg - limitKg) },
    }]
  })
}
