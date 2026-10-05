import { gt } from '@/domain/geometry'
import type { VehicleConfig } from '@/domain/models'
import { axleLoadsOf, type AxleLoads } from './axle-load'

type AxleVehicle = Pick<VehicleConfig, 'axles' | 'frontAxleLimitKg' | 'rearAxleLimitKg'>

/**
 * Độ lệch tải giữa hai nhóm trục (FE-5b-05): |tải trước / giới hạn trước − tải sau / giới hạn sau|, số chưa làm tròn. 0 là hai nhóm
 * cùng mức dùng; càng lớn càng lệch. `undefined` khi không tính được tải trục hoặc một nhóm chưa có giới hạn — khi đó không có gì
 * để so mức dùng.
 */
export function axleImbalance(loads: AxleLoads): number | undefined {
  if (loads.status !== 'computed') return undefined
  const { front, rear } = loads
  if (front.limitKg === undefined || rear.limitKg === undefined) return undefined
  return Math.abs(front.loadKg / front.limitKg - rear.loadKg / rear.limitKg)
}

/**
 * Hoành độ trọng tâm hàng (cm, cùng trục X của thùng) mà tại đó hai nhóm trục cùng mức dùng, với khối hàng nặng `totalKg` — nghiệm
 * của tải trước / giới hạn trước = tải sau / giới hạn sau trong mô hình đòn bẩy của `axleLoadsOf`. Có thể nằm ngoài lòng thùng (xe
 * rỗng đã lệch hẳn về một nhóm); nơi gọi tự kẹp vào khoảng đặt hàng được. `undefined` khi không tính được tải trục, thiếu giới hạn
 * của một nhóm, hoặc chưa có khối lượng.
 */
export function balancedCenterXCm(vehicle: AxleVehicle, totalKg: number): number | undefined {
  const empty = axleLoadsOf(vehicle, { totalKg: 0 })
  if (empty.status !== 'computed' || !gt(totalKg, 0)) return undefined
  const { front, rear } = empty
  if (front.limitKg === undefined || rear.limitKg === undefined) return undefined
  const wheelbaseCm = rear.positionXCm - front.positionXCm
  const emptyTermCm = (wheelbaseCm * (rear.limitKg * front.emptyLoadKg - front.limitKg * rear.emptyLoadKg)) / totalKg
  return (emptyTermCm + rear.limitKg * rear.positionXCm + front.limitKg * front.positionXCm) / (front.limitKg + rear.limitKg)
}
