import type { CargoPackage } from '@/domain/models'
import { REQUIREMENT_PRIORITIES, type RequirementPriority } from './requirement-model'
import type { DeliveryStop } from './types'

/**
 * Điểm giao tự sinh (FE-4b-04, D-73) — hàm thuần, kho gọi khi đưa yêu cầu giao vào chuyến, gỡ yêu cầu, bỏ kiện:
 *
 * - yêu cầu **cùng địa chỉ (đã chuẩn hoá) và cùng toạ độ** với một điểm đang có thì vào điểm đó, không thì sinh điểm mới cuối tuyến;
 * - hạn của điểm = hạn sớm nhất, ưu tiên = cao nhất trong các yêu cầu có kiện ở điểm đó; điểm không có yêu cầu nào thì không có hạn;
 * - điểm tự sinh không còn dòng kiện nào tự mất, kiện ở các điểm sau được đánh số lại; điểm thêm tay thì ở lại.
 */

const PUNCTUATION = /[,.;:\-–—]+/g
const WHITESPACE = /\s+/g

/**
 * Địa chỉ để so: chữ thường, bỏ dấu câu, gộp khoảng trắng. **Giữ dấu tiếng Việt** — "Thanh Hoá" và "Thanh Hoà" là hai nơi khác nhau;
 * tìm kiếm mới bỏ dấu (`normalizeSearchText`), gộp điểm giao thì không.
 */
export function normalizeAddress(address: string): string {
  return address.normalize('NFC').toLocaleLowerCase('vi').replace(PUNCTUATION, ' ').replace(WHITESPACE, ' ').trim()
}

type StopPlace = Pick<DeliveryStop, 'address' | 'lat' | 'lng'>

/** Toạ độ so tới năm chữ số lẻ (khoảng 1 m). */
const coordinate = (value: number | undefined) => (value === undefined ? '' : value.toFixed(5))

/** Khoá gộp điểm: địa chỉ chuẩn hoá + vĩ độ + kinh độ. Chưa có toạ độ là một giá trị riêng — không gộp với điểm đã có toạ độ. */
export function stopKey({ address, lat, lng }: StopPlace): string {
  const hasPoint = lat !== undefined && lng !== undefined
  return `${normalizeAddress(address)}|${hasPoint ? coordinate(lat) : ''}|${hasPoint ? coordinate(lng) : ''}`
}

/** Mã điểm giao kế tiếp của chuyến: `STOP-NN` sau số lớn nhất đang có (mã khác dạng không tính). */
export function nextStopId(stops: readonly Pick<DeliveryStop, 'id'>[]): string {
  const numbers = stops.map((stop) => Number(/^STOP-(\d+)$/.exec(stop.id)?.[1] ?? 0))
  return `STOP-${String(Math.max(0, ...numbers) + 1).padStart(2, '0')}`
}

type Destination = { destinationName: string; address: string; lat?: number; lng?: number }

/**
 * Điểm giao của một yêu cầu trong chuyến: điểm đang có cùng khoá (tự sinh hay thêm tay), không có thì thêm điểm tự sinh cuối danh sách
 * — tên là tên điểm đến của yêu cầu. `index` là vị trí của điểm trong `stops` trả về.
 */
export function requirementStop(stops: readonly DeliveryStop[], destination: Destination): { stops: DeliveryStop[]; index: number; created: boolean } {
  const key = stopKey(destination)
  const index = stops.findIndex((stop) => stopKey(stop) === key)
  if (index !== -1) return { stops: [...stops], index, created: false }
  const { destinationName, address, lat, lng } = destination
  const stop: DeliveryStop = {
    id: nextStopId(stops), name: destinationName, address,
    ...(lat === undefined || lng === undefined ? {} : { lat, lng }),
    generated: true,
  }
  return { stops: [...stops, stop], index: stops.length, created: true }
}

/** Một yêu cầu có kiện ở điểm số `deliveryStop`. */
export type StopDemand = { deliveryStop: number; deadline: string; priority: RequirementPriority }

const rank = (priority: RequirementPriority) => REQUIREMENT_PRIORITIES.indexOf(priority)

/** Ghi lại hạn và ưu tiên của từng điểm theo các yêu cầu đang ở điểm đó; điểm không còn yêu cầu nào thì gỡ cả hai trường. */
export function withStopDemands(stops: readonly DeliveryStop[], demands: readonly StopDemand[]): DeliveryStop[] {
  return stops.map((stop, index) => {
    const { deadline: _deadline, priority: _priority, ...rest } = stop
    const here = demands.filter((demand) => demand.deliveryStop === index + 1)
    const [first] = here
    if (!first) return rest
    const deadline = here.reduce((earliest, demand) => (Date.parse(demand.deadline) < Date.parse(earliest) ? demand.deadline : earliest), first.deadline)
    const priority = here.reduce((highest, demand) => (rank(demand.priority) > rank(highest) ? demand.priority : highest), first.priority)
    return { ...rest, deadline, priority }
  })
}

/**
 * Bỏ các điểm tự sinh không còn dòng kiện nào; dòng kiện ở các điểm sau lùi số theo. Không điểm nào phải bỏ thì trả lại chính hai
 * mảng đã nhận.
 */
export function pruneGeneratedStops<S extends DeliveryStop, P extends CargoPackage>(stops: readonly S[], packages: readonly P[]): { stops: readonly S[]; packages: readonly P[] } {
  const used = new Set(packages.map((pkg) => pkg.deliveryStop))
  const keep = stops.map((stop, index) => stop.generated !== true || used.has(index + 1))
  if (keep.every(Boolean)) return { stops, packages }
  const numberAfter = new Map<number, number>()
  let next = 0
  keep.forEach((kept, index) => {
    if (kept) numberAfter.set(index + 1, (next += 1))
  })
  return {
    stops: stops.filter((_, index) => keep[index]),
    packages: packages.map((pkg) => {
      const deliveryStop = numberAfter.get(pkg.deliveryStop) ?? pkg.deliveryStop
      return deliveryStop === pkg.deliveryStop ? pkg : { ...pkg, deliveryStop }
    }),
  }
}
