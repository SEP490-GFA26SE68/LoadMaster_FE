import type { VehicleConfig } from '@/domain/models'
import { addDays, vnTime } from './clock'
import { cargoFromType } from './package-type-cargo'
import { randomQrToken, seededRandom } from './qr-token'
import { seedPlanner } from './seed-plan'
import type { SeedEvent } from './seed-progress'
import { PHUONG_NAM } from './seed-users'
import type { OptimizationRun, PackageType, RegisteredPackage, TransportOrder, VehicleType } from './source-types'
import type { DeliveryStop, Revision, Trip } from './types'

/**
 * Bộ dữ liệu nhỏ của Công ty CP Giao nhận Phương Nam (`LOG-002`, D-64, FE-0-02), đủ để thấy hai công ty không nhìn thấy dữ liệu của
 * nhau: 2 xe, 1 loại xe, 2 loại kiện, 10 kiện đăng ký, 1 đơn chờ gán và 2 chuyến — một chuyến hôm nay đã duyệt phương án, gán tài xế
 * `taixe@phuongnam.vn`, chờ kho Phú Thuận xếp; một chuyến nháp ngày mai.
 *
 * Mã mang `PN` (`TRIP-PN-001`, `VEHICLE-PN-01`, `REV-PN-001`…): `nextId` chỉ tính mã dạng `PREFIX-NNN`, nên mã kế tiếp của kho vẫn
 * là `TRIP-015`, `VEHICLE-009`, `REV-028`… như các test và E2E đang ghi (quyết định G9). Mốc giờ đều trước 11:40 ngày neo — sự kiện
 * muộn nhất của seed vẫn là của Long Bình (`seed-shift.ts` neo theo nó).
 */

const DISPATCHER = 'US-PN-03'
const DRIVER = 'US-PN-04'

export type PhuongNamSeed = {
  vehicles: VehicleConfig[]
  trips: Trip[]
  revisions: Revision[]
  runs: OptimizationRun[]
  events: SeedEvent[]
  packageTypes: PackageType[]
  registeredPackages: RegisteredPackage[]
  orders: TransportOrder[]
  vehicleTypes: VehicleType[]
  vehicleTypeOf: [string, string][]
}

const VEHICLES: readonly VehicleConfig[] = [
  {
    id: 'VEHICLE-PN-01',
    name: 'Isuzu QKR 230 · 51C-907.41',
    innerLengthCm: 430,
    innerWidthCm: 186,
    innerHeightCm: 187,
    maxPayloadKg: 2300,
    doorWidthCm: 176,
    doorHeightCm: 177,
    doorPosition: 'REAR',
    clearanceCm: 0,
    obstacles: [
      { id: 'OBS-001', type: 'WHEEL_ARCH', xCm: 250, yCm: 0, zCm: 0, lengthCm: 70, widthCm: 18, heightCm: 22, loadBearing: false },
      { id: 'OBS-002', type: 'WHEEL_ARCH', xCm: 250, yCm: 168, zCm: 0, lengthCm: 70, widthCm: 18, heightCm: 22, loadBearing: false },
    ],
  },
  {
    id: 'VEHICLE-PN-02',
    name: 'Hino XZU730 · 51D-318.62',
    innerLengthCm: 560,
    innerWidthCm: 205,
    innerHeightCm: 205,
    maxPayloadKg: 4800,
    doorWidthCm: 195,
    doorHeightCm: 195,
    doorPosition: 'REAR',
    clearanceCm: 0,
    obstacles: [
      { id: 'OBS-001', type: 'WHEEL_ARCH', xCm: 330, yCm: 0, zCm: 0, lengthCm: 90, widthCm: 20, heightCm: 26, loadBearing: false },
      { id: 'OBS-002', type: 'WHEEL_ARCH', xCm: 330, yCm: 185, zCm: 0, lengthCm: 90, widthCm: 20, heightCm: 26, loadBearing: false },
    ],
  },
]

type TypeSeed = Omit<PackageType, 'companyId' | 'createdAt'>

/** Hàng của Phương Nam: linh kiện điện tử và vải cuộn — khác hẳn hàng tạp hoá của Long Bình, dễ nhận ra khi kiểm cách ly. */
const ELECTRONICS: TypeSeed = {
  id: 'PT-PN-01', name: 'Thùng linh kiện điện tử', lengthCm: 50, widthCm: 40, heightCm: 30, weightKg: 9, fragilityLevel: 'MEDIUM',
  allowedOrientations: ['LWH', 'WLH'], keepUpright: true, stackable: true, maxStackCount: 4, maxTopLoadKg: 27,
}
const FABRIC: TypeSeed = {
  id: 'PT-PN-02', name: 'Kiện vải cuộn', lengthCm: 120, widthCm: 40, heightCm: 40, weightKg: 28, fragilityLevel: 'NONE',
  allowedOrientations: ['LWH', 'WLH'], keepUpright: true, stackable: true, maxStackCount: 4, maxTopLoadKg: 84,
}

const CUSTOMERS = {
  crescent: { name: 'Crescent Mall – kho nhận hàng', address: '101 Tôn Dật Tiên, P. Tân Phú, Q.7, TP. Hồ Chí Minh', phone: '0283 541 3388', contactName: 'Anh Nhân' },
  xuongMayNhaBe: { name: 'Xưởng may Hiệp Phước', address: '18 Nguyễn Văn Tạo, X. Hiệp Phước, Nhà Bè', phone: '0283 873 8120', contactName: 'Chị Diệp' },
  linhKienQ4: { name: 'Cửa hàng linh kiện Khánh Hội', address: '264 Khánh Hội, P. 6, Q.4, TP. Hồ Chí Minh', phone: '0938 406 715', contactName: 'Anh Thịnh' },
  vaiSoiQ1: { name: 'Vải sợi Tôn Thất Đạm', address: '36 Tôn Thất Đạm, P. Nguyễn Thái Bình, Q.1, TP. Hồ Chí Minh', phone: '0283 821 4472', contactName: 'Chị Quyên' },
} satisfies Record<string, Omit<DeliveryStop, 'id'>>

type CustomerKey = keyof typeof CUSTOMERS

const stops = (keys: readonly CustomerKey[]): DeliveryStop[] => keys.map((key, index) => ({ id: `STOP-${String(index + 1).padStart(2, '0')}`, ...CUSTOMERS[key] }))

/** Dòng kiện của chuyến: loại hàng, số lượng, số điểm giao; mã `PKG-001`… theo thứ tự dòng. */
const lines = (items: readonly (readonly [TypeSeed, number, number])[]) =>
  items.map(([type, quantity, deliveryStop], index) => cargoFromType(type, { id: `PKG-${String(index + 1).padStart(3, '0')}`, quantity, deliveryStop }))

/** `taken`: mã QR đã cấp cho kiện của công ty khác — mã mới không trùng. */
export function seedPhuongNam(today: string, taken: ReadonlySet<string>): PhuongNamSeed {
  const on = (daysAgo: number, time: string) => vnTime(addDays(today, -daysAgo), time)
  const events: SeedEvent[] = []
  const revisions: Revision[] = []
  const runs: OptimizationRun[] = []
  const vehicles = structuredClone([...VEHICLES])
  const plan = seedPlanner({
    vehicles, actorId: DISPATCHER, revisions, runs, events,
    revisionId: (order) => `REV-PN-${String(order).padStart(3, '0')}`,
    runId: (order) => `RUN-PN-${String(order).padStart(3, '0')}`,
  })

  const packageTypes: PackageType[] = [ELECTRONICS, FABRIC].map((type) => ({ ...type, allowedOrientations: [...type.allowedOrientations], companyId: PHUONG_NAM, createdAt: on(21, '10:00') }))

  const random = seededRandom(20_260_915)
  const tokens = new Set(taken)
  const registeredPackages: RegisteredPackage[] = []
  function register(type: TypeSeed, count: number, status: 'registered' | 'received', at: string, reference: string): RegisteredPackage[] {
    const start = registeredPackages.length
    const batch = Array.from({ length: count }, (_, index): RegisteredPackage => {
      const qrToken = randomQrToken(random, (token) => tokens.has(token))
      tokens.add(qrToken)
      return {
        id: `RPK-PN-${String(start + index + 1).padStart(4, '0')}`, packageTypeId: type.id, ownerCompanyId: PHUONG_NAM, qrToken,
        status, reference, registeredAt: at, registeredBy: DISPATCHER,
      }
    })
    registeredPackages.push(...batch)
    events.push({ at, actorId: DISPATCHER, action: 'package.registered', target: { type: 'package', id: batch[0]?.id ?? '' }, params: { count, packageTypeId: type.id, lastPackageId: batch.at(-1)?.id ?? '' } })
    return batch
  }
  // RPK-PN-0001…0006 linh kiện đã ở kho; RPK-PN-0007…0010 vải cuộn đăng ký sáng ngày neo, hàng chưa về
  const electronics = register(ELECTRONICS, 6, 'received', on(2, '09:30'), 'PN-LK-0912')
  register(FABRIC, 4, 'registered', on(0, '07:25'), 'PN-VC-0914')

  // Đơn chờ gán giao tới Khánh Hội — điểm 1 của chuyến nháp TRIP-PN-002, gán thẳng được
  const ordered = electronics.slice(0, 4)
  for (const pkg of ordered) pkg.orderId = 'ORD-PN-001'
  const orderAt = on(0, '07:40')
  const orders: TransportOrder[] = [{
    id: 'ORD-PN-001', companyId: PHUONG_NAM, customerName: CUSTOMERS.linhKienQ4.name, deliveryAddress: CUSTOMERS.linhKienQ4.address,
    contactName: CUSTOMERS.linhKienQ4.contactName, phone: CUSTOMERS.linhKienQ4.phone, packageIds: ordered.map((pkg) => pkg.id),
    status: 'pending', createdAt: orderAt, createdBy: DISPATCHER,
  }]
  events.push({ at: orderAt, actorId: DISPATCHER, action: 'order.created', target: { type: 'order', id: 'ORD-PN-001' }, params: { customerName: CUSTOMERS.linhKienQ4.name, count: ordered.length } })

  // Chuyến hôm nay: lập chiều hôm trước, tối ưu rồi duyệt — chờ kho Phú Thuận xếp, tài xế Phương Nam thấy ở "Chuyến của tôi"
  const approved: Trip = {
    id: 'TRIP-PN-001', companyId: PHUONG_NAM, name: 'Tuyến Quận 7 – Nhà Bè', vehicleId: 'VEHICLE-PN-01', scheduledDate: today, driverId: DRIVER,
    phase: 'planning', createdAt: on(1, '15:05'), inputVersion: 1,
    stops: stops(['crescent', 'xuongMayNhaBe']),
    packages: lines([[ELECTRONICS, 30, 1], [FABRIC, 12, 2]]),
  }
  events.push({ at: approved.createdAt, actorId: DISPATCHER, action: 'trip.created', target: { type: 'trip', id: approved.id }, params: { name: approved.name } })
  plan(approved, 20_260_951, { optimized: on(1, '15:35'), approved: on(1, '16:05') })

  const draft: Trip = {
    id: 'TRIP-PN-002', companyId: PHUONG_NAM, name: 'Tuyến Quận 4 – Quận 1', vehicleId: 'VEHICLE-PN-02', scheduledDate: addDays(today, 1), driverId: null,
    phase: 'planning', createdAt: on(0, '07:35'), inputVersion: 1,
    stops: stops(['linhKienQ4', 'vaiSoiQ1']),
    packages: lines([[ELECTRONICS, 20, 1], [FABRIC, 8, 2]]),
  }
  events.push({ at: draft.createdAt, actorId: DISPATCHER, action: 'trip.created', target: { type: 'trip', id: draft.id }, params: { name: draft.name } })

  const vehicleTypes: VehicleType[] = [
    { id: 'VT-PN-01', companyId: PHUONG_NAM, name: 'Xe tải 2,3 tấn thùng 4,3 m', cargoLengthCm: 430, cargoWidthCm: 186, cargoHeightCm: 187, payloadKg: 2300, createdAt: on(21, '09:30') },
  ]

  return {
    vehicles, trips: [approved, draft], revisions, runs, events, packageTypes, registeredPackages, orders, vehicleTypes,
    vehicleTypeOf: [['VEHICLE-PN-01', 'VT-PN-01']],
  }
}
