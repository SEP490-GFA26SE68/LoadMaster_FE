import { SPEC_TRUCK_6M } from '@/domain/fixtures/spec-samples'
import type { CargoPackage, OptimizationRequest } from '@/domain/models'

/**
 * Chuyến mẫu của khung 3D trên trang giới thiệu: thùng 6 m của Spec mục 12 (600 × 240 × 250 cm, 5.000 kg, hốc bánh xe không chịu tải)
 * và bốn dòng kiện cho bốn điểm giao — 366 kiện, chồng tới 240 cm. Kết quả không lưu sẵn ở đây: bộ tối ưu mô phỏng chạy trên trình duyệt của người xem
 * (`landing-sample-api.ts`) nên mọi số trên khung là số của lần chạy đó, kèm MOCK RESULT. Mã kiện viết ASCII vì có thể lọt vào DOM
 * (nhãn của khung 3D) mà bản tiếng Anh không được có chữ có dấu; tên điểm giao lấy từ từ điển (`landing.sample.*`).
 */
const LINE_DEFAULTS = {
  allowedOrientations: ['LWH', 'WLH'],
  keepUpright: true,
  fragilityLevel: 'NONE',
  stackable: true,
  minSupportRatio: 0.8,
  priority: 1,
  mustLoad: true,
} as const satisfies Partial<CargoPackage>

type SampleLine = Pick<CargoPackage, 'id' | 'lengthCm' | 'widthCm' | 'heightCm' | 'weightKg' | 'maxTopLoadKg' | 'maxStackCount' | 'quantity' | 'deliveryStop'>

const LINES: readonly SampleLine[] = [
  { id: 'SKU-A', lengthCm: 60, widthCm: 40, heightCm: 40, weightKg: 15, maxTopLoadKg: 90, maxStackCount: 6, quantity: 96, deliveryStop: 1 },
  { id: 'SKU-B', lengthCm: 60, widthCm: 40, heightCm: 30, weightKg: 10, maxTopLoadKg: 80, maxStackCount: 8, quantity: 96, deliveryStop: 2 },
  { id: 'SKU-C', lengthCm: 80, widthCm: 60, heightCm: 48, weightKg: 30, maxTopLoadKg: 130, maxStackCount: 5, quantity: 30, deliveryStop: 3 },
  { id: 'SKU-D', lengthCm: 40, widthCm: 30, heightCm: 30, weightKg: 6, maxTopLoadKg: 50, maxStackCount: 8, quantity: 144, deliveryStop: 4 },
]

/** Số điểm giao của chuyến mẫu; tên từng điểm ở `landing.sample.stop1` … `stop4`. */
export const LANDING_STOP_COUNT = 4

export const LANDING_REQUEST: OptimizationRequest = {
  vehicle: SPEC_TRUCK_6M,
  packages: LINES.map((line) => ({ ...LINE_DEFAULTS, allowedOrientations: [...LINE_DEFAULTS.allowedOrientations], name: line.id, ...line })),
  settings: { method: 'MOCK', timeLimitSeconds: 30, randomSeed: 1, enforceLifo: true, prioritizeLowCenterOfGravity: false },
}
