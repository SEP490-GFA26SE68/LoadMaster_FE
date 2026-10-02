import { addDays, vnTime } from './clock'
import type { Package } from './package-model'
import type { DeliveryRequirement, RequirementPriority } from './requirement-model'
import type { SeedEvent } from './seed-progress'

/**
 * Yêu cầu giao của seed (FE-4b-01, PRD v2 mục 10): mọi yêu cầu `PENDING`, do quản lý công ty lập, tới điểm đến thật với toạ độ thật ở
 * mức khu vực (không tới số nhà). Hạn neo theo ngày `today` (D-44): `dueInDays` ngày sau ngày neo, giờ Việt Nam — `seed-shift.ts` không
 * dời hạn.
 */
export type RequirementSeed = {
  id: string
  destinationName: string
  address: string
  lat: number
  lng: number
  /** Hạn: số ngày sau ngày neo và giờ `HH:mm`. */
  due: readonly [dueInDays: number, time: string]
  priority: RequirementPriority
  /** Kiện kho kiện của yêu cầu; hàm dựng ghi `requirementId` vào từng kiện. */
  packages: readonly Package[]
  /** Thời điểm lập, ISO 8601. */
  createdAt: string
  note?: string
}

/** Sáu điểm đến của Long Bình, theo thứ tự lập. Bốn điểm đầu là khu công nghiệp ghi trong file nhập `LONG_BINH_IMPORT`. */
export const LONG_BINH_DESTINATIONS = {
  hoaKhanh: { destinationName: 'KCN Hoà Khánh', address: 'KCN Hoà Khánh, Q. Liên Chiểu, Đà Nẵng', lat: 16.0747, lng: 108.1506 },
  phuBai: { destinationName: 'KCN Phú Bài', address: 'KCN Phú Bài, TX. Hương Thuỷ, Thừa Thiên Huế', lat: 16.4022, lng: 107.696 },
  thangLong: { destinationName: 'KCN Thăng Long', address: 'KCN Thăng Long, H. Đông Anh, Hà Nội', lat: 21.1186, lng: 105.7797 },
  traNoc: { destinationName: 'KCN Trà Nóc', address: 'KCN Trà Nóc, Q. Bình Thuỷ, Cần Thơ', lat: 10.1028, lng: 105.7103 },
  coopBinhDuong: { lat: 10.979, lng: 106.673 },
  bhxDiAn: { lat: 10.896, lng: 106.789 },
} as const

export function seedRequirements(options: {
  companyId: string
  /** Quản lý công ty lập yêu cầu. */
  actorId: string
  today: string
  specs: readonly RequirementSeed[]
  events: SeedEvent[]
}): DeliveryRequirement[] {
  const { companyId, actorId, today, specs, events } = options
  return specs.map((spec) => {
    for (const pkg of spec.packages) pkg.requirementId = spec.id
    events.push({
      at: spec.createdAt, actorId, action: 'requirement.created', target: { type: 'requirement', id: spec.id },
      params: { destinationName: spec.destinationName, count: spec.packages.length, priority: spec.priority },
    })
    return {
      id: spec.id, companyId, destinationName: spec.destinationName, address: spec.address, lat: spec.lat, lng: spec.lng,
      deadline: vnTime(addDays(today, spec.due[0]), spec.due[1]), priority: spec.priority, packageIds: spec.packages.map((pkg) => pkg.id),
      ...(spec.note === undefined ? {} : { note: spec.note }), status: 'PENDING', createdAt: spec.createdAt, createdBy: actorId,
    }
  })
}
