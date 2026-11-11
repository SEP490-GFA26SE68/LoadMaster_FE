import type { DeliveryRequirement } from '@/lib/mock-db'

/**
 * DTO yêu cầu giao của backend và phép đổi sang kiểu của app. Chỉ các file `-api` của yêu cầu giao import file này: kiểu DTO không đi ra
 * khỏi lớp `-api`. Mốc giờ của backend là `LocalDateTime` theo giờ Việt Nam, không múi giờ.
 */

export type DeliveryRequirementApi = {
  id: number
  companyId: number
  customerId: number | null
  customerName: string | null
  destination: string
  destinationLat: number | null
  destinationLng: number | null
  deadline: string
  priority: DeliveryRequirement['priority']
  status: DeliveryRequirement['status']
  /** Kho đã bỏ kiện của yêu cầu khỏi chuyến (thiếu, hỏng); máy chủ cũ không trả. */
  droppedPackageCount?: number | null
  shortDelivered?: boolean | null
  expectedPackageCount: number | null
  receivedPackageCount: number
  packageIds: number[]
  note: string | null
  tripId: number | null
  tripCode: string | null
  createdBy: number | null
  createdAt: string
}

/** Mốc giờ Việt Nam không múi giờ của backend → ISO có múi giờ. */
export function vietnamIso(value: string): string {
  return /(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}+07:00`
}

/** Thời điểm ISO → `LocalDateTime` theo giờ Việt Nam mà Spring nhận (`yyyy-MM-ddTHH:mm:00`). */
export function toVietnamLocalDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error('Hạn giao không đọc được')
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:00`
}

/** Mã số của máy chủ từ mã chuỗi của app; mã không phải số nguyên dương là lỗi của nơi gọi. */
export function serverId(id: string): number {
  const value = Number(id)
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`Mã ${id} không phải mã số của máy chủ`)
  return value
}

export function requirementFromApi(api: DeliveryRequirementApi): DeliveryRequirement {
  return {
    id: String(api.id),
    companyId: String(api.companyId),
    customerId: api.customerId == null ? undefined : String(api.customerId),
    customerName: api.customerName ?? undefined,
    // Backend chưa lưu tên điểm đến riêng
    destinationName: api.destination,
    address: api.destination,
    ...(api.destinationLat == null ? {} : { lat: api.destinationLat }),
    ...(api.destinationLng == null ? {} : { lng: api.destinationLng }),
    deadline: vietnamIso(api.deadline),
    priority: api.priority,
    status: api.status,
    packageIds: api.packageIds.map(String),
    expectedPackageCount: api.expectedPackageCount ?? undefined,
    receivedPackageCount: api.receivedPackageCount,
    note: api.note ?? undefined,
    tripId: api.tripId == null ? undefined : String(api.tripId),
    tripCode: api.tripCode == null ? undefined : String(api.tripCode),
    createdBy: api.createdBy == null ? null : String(api.createdBy),
    createdAt: vietnamIso(api.createdAt),
  }
}
