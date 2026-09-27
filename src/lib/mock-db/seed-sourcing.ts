import { addDays, vnTime } from './clock'
import { cargoFromType } from './package-type-cargo'
import { randomQrToken, seededRandom } from './qr-token'
import { CARGO, CUSTOMERS, type CargoKey } from './seed-directory'
import type { SeedEvent } from './seed-progress'
import { SEED_ADMIN, SEED_DISPATCHER } from './seed-trips'
import type { Company, PackageType, RegisteredPackage, Shipment, TransportOrder, VehicleType } from './source-types'

/**
 * Seed Review 1 (LM-104): hai nhà sản xuất, hai công ty logistics, danh mục loại kiện (lấy từ danh mục hàng của 15 chuyến seed), kiện
 * đăng ký kèm mã QR, lô hàng ở đủ các trạng thái, hai đơn chờ gán và danh mục loại xe của đội xe. Mốc giờ neo theo ngày `today` (D-44).
 * Mã QR sinh từ bộ số giả ngẫu nhiên có hạt giống cố định: tất định, không chứa dữ liệu kiện.
 */

export const SEED_MANUFACTURER_USER = 'US-0013'
export const SEED_LOGISTICS_USER = 'US-0014'

export const COMPANIES: readonly Company[] = [
  { id: 'MFR-001', kind: 'manufacturer', name: 'Công ty CP Thực phẩm Minh Phát', address: 'Lô 18, KCN Tân Tạo, Bình Tân, TP. Hồ Chí Minh', phone: '0283 750 4411' },
  { id: 'MFR-002', kind: 'manufacturer', name: 'Công ty TNHH Gia dụng Hoà Bình', address: '27 Đường số 3, KCN Sóng Thần 2, Dĩ An, Bình Dương', phone: '0274 373 2086' },
  { id: 'LOG-001', kind: 'logistics', name: 'Công ty TNHH Vận tải Long Bình', address: 'Kho Long Bình, 9 Đường 3A, KCN Biên Hoà 2, Đồng Nai', phone: '0251 383 6120' },
  { id: 'LOG-002', kind: 'logistics', name: 'Công ty CP Giao nhận Phương Nam', address: '102 Nguyễn Văn Quỳ, P. Phú Thuận, Q.7, TP. Hồ Chí Minh', phone: '0283 773 9054' },
]

/** Loại kiện theo danh mục hàng seed: kích thước, khối lượng, hướng đặt và xếp chồng giữ nguyên. */
const TYPE_KEYS: readonly CargoKey[] = ['nuocSuoi', 'miGoi', 'dauAn', 'suaHop', 'banhQuy', 'quatDien', 'noiComDien', 'nuocGiat']

export type SourcingSeed = {
  companies: Company[]
  packageTypes: PackageType[]
  registeredPackages: RegisteredPackage[]
  shipments: Shipment[]
  orders: TransportOrder[]
  vehicleTypes: VehicleType[]
  vehicleTypeOf: [string, string][]
}

const typeId = (key: CargoKey) => `PT-${String(TYPE_KEYS.indexOf(key) + 1).padStart(3, '0')}`

export function seedSourcing(today: string, events: SeedEvent[]): SourcingSeed {
  const on = (daysAgo: number, time: string) => vnTime(addDays(today, -daysAgo), time)
  const addMinutes = (iso: string, minutes: number) => new Date(Date.parse(iso) + minutes * 60_000).toISOString()
  const random = seededRandom(20_260_914)
  const tokens = new Set<string>()

  const packageTypes: PackageType[] = TYPE_KEYS.map((key) => {
    const cargo = cargoFromType({ ...CARGO[key], allowedOrientations: [...CARGO[key].allowedOrientations] }, { id: typeId(key), quantity: 1, deliveryStop: 1 })
    return {
      id: typeId(key), name: cargo.name, lengthCm: cargo.lengthCm, widthCm: cargo.widthCm, heightCm: cargo.heightCm, weightKg: cargo.weightKg,
      fragilityLevel: cargo.fragilityLevel, allowedOrientations: cargo.allowedOrientations, keepUpright: cargo.keepUpright, stackable: cargo.stackable,
      maxTopLoadKg: cargo.maxTopLoadKg, ...(cargo.maxStackCount === undefined ? {} : { maxStackCount: cargo.maxStackCount }), createdAt: on(30, '09:00'),
    }
  })

  const registeredPackages: RegisteredPackage[] = []
  /** Một đợt đăng ký `count` kiện cùng loại, kèm sự kiện nhật ký như `registerPackages`. */
  function register(key: CargoKey, count: number, owner: string, at: string, by: string, reference: string): RegisteredPackage[] {
    const start = registeredPackages.length
    const batch = Array.from({ length: count }, (_, index): RegisteredPackage => {
      const qrToken = randomQrToken(random, (token) => tokens.has(token))
      tokens.add(qrToken)
      return {
        id: `RPK-${String(start + index + 1).padStart(4, '0')}`, packageTypeId: typeId(key), ownerCompanyId: owner, qrToken,
        status: 'registered', reference, registeredAt: at, registeredBy: by,
      }
    })
    registeredPackages.push(...batch)
    events.push({ at, actorId: by, action: 'package.registered', target: { type: 'package', id: batch[0]?.id ?? '' }, params: { count, packageTypeId: typeId(key), lastPackageId: batch.at(-1)?.id ?? '' } })
    return batch
  }

  const water = register('nuocSuoi', 12, 'MFR-001', on(3, '09:00'), SEED_MANUFACTURER_USER, 'MP-NS24-0911')
  const noodles = register('miGoi', 10, 'MFR-001', on(3, '09:10'), SEED_MANUFACTURER_USER, 'MP-MG30-0911')
  const milk = register('suaHop', 6, 'MFR-001', on(1, '14:30'), SEED_MANUFACTURER_USER, 'MP-SH48-0913')
  const biscuits = register('banhQuy', 6, 'MFR-001', on(1, '14:40'), SEED_MANUFACTURER_USER, 'MP-BQ-0913')
  register('dauAn', 8, 'MFR-001', on(0, '08:20'), SEED_MANUFACTURER_USER, 'MP-DA12-0914')
  const fans = register('quatDien', 6, 'MFR-002', on(2, '10:00'), SEED_ADMIN, 'HB-QD16-0912')

  const shipments: Shipment[] = []
  function ship(id: string, manufacturerId: string, logisticsCompanyId: string, packages: RegisteredPackage[], by: string, created: string, handedOver: string) {
    for (const pkg of packages) Object.assign(pkg, { shipmentId: id, status: 'in_shipment' })
    const shipment: Shipment = {
      id, manufacturerId, logisticsCompanyId, packageIds: packages.map((pkg) => pkg.id), status: 'handed_over',
      createdAt: created, createdBy: by, handedOverAt: handedOver, handedOverBy: by, receipts: [],
    }
    const target = { type: 'shipment' as const, id }
    events.push(
      { at: created, actorId: by, action: 'shipment.created', target, params: { count: packages.length, logisticsCompanyId } },
      { at: handedOver, actorId: by, action: 'shipment.handedOver', target, params: { count: packages.length, logisticsCompanyId } },
    )
    shipments.push(shipment)
    return shipment
  }
  /** Logistics quét nhận `packages` bắt đầu từ `start`, mỗi kiện cách nhau một phút. */
  function receive(shipment: Shipment, packages: RegisteredPackage[], start: string) {
    packages.forEach((pkg, index) => {
      const at = addMinutes(start, index)
      Object.assign(pkg, { status: 'received', received: { at, by: SEED_LOGISTICS_USER } })
      shipment.receipts.push({ packageId: pkg.id, at, by: SEED_LOGISTICS_USER })
      events.push({ at, actorId: SEED_LOGISTICS_USER, action: 'shipment.packageReceived', target: { type: 'shipment', id: shipment.id }, params: { packageId: pkg.id, received: shipment.receipts.length, count: shipment.packageIds.length } })
    })
    shipment.status = shipment.receipts.length === shipment.packageIds.length ? 'received' : 'partially_received'
  }

  // Lô đã nhận đủ (nguồn của hai đơn chờ gán), lô đang nhận dở (demo quét QR), lô giao công ty khác (demo quét sai công ty)
  const first = ship('SHP-001', 'MFR-001', 'LOG-001', [...water, ...noodles], SEED_MANUFACTURER_USER, on(3, '10:00'), on(2, '08:00'))
  receive(first, [...water, ...noodles], on(1, '07:00'))
  const second = ship('SHP-002', 'MFR-001', 'LOG-001', [...milk, ...biscuits], SEED_MANUFACTURER_USER, on(1, '15:00'), on(0, '07:30'))
  receive(second, [...milk.slice(0, 4)], on(0, '08:00'))
  ship('SHP-003', 'MFR-002', 'LOG-002', fans, SEED_ADMIN, on(2, '11:00'), on(1, '16:00'))

  const order = function (id: string, customer: { name: string; address: string; phone: string; contactName: string }, packages: RegisteredPackage[], at: string): TransportOrder {
    for (const pkg of packages) pkg.orderId = id
    events.push({ at, actorId: SEED_DISPATCHER, action: 'order.created', target: { type: 'order', id }, params: { customerName: customer.name, count: packages.length } })
    return {
      id, customerName: customer.name, deliveryAddress: customer.address, contactName: customer.contactName, phone: customer.phone,
      packageIds: packages.map((pkg) => pkg.id), status: 'pending', createdAt: at, createdBy: SEED_DISPATCHER,
    }
  }
  // ORD-002 giao tới Bách Hoá Xanh Dĩ An — điểm 2 của chuyến nháp TRIP-014, gán thẳng được để demo luồng 2
  const orders: TransportOrder[] = [
    order('ORD-001', CUSTOMERS.coopBinhDuong, water, on(0, '08:40')),
    order('ORD-002', CUSTOMERS.bhxDiAn, noodles, on(0, '08:45')),
  ]

  return { companies: [...COMPANIES], packageTypes, registeredPackages, shipments, orders, ...seedVehicleTypes(on(40, '09:00')) }
}

/** Loại xe của đội xe seed; VEHICLE-008 để trống (xe có thể chưa gắn loại). */
function seedVehicleTypes(createdAt: string): Pick<SourcingSeed, 'vehicleTypes' | 'vehicleTypeOf'> {
  const types: [string, string, number, number, number, number, string][] = [
    ['VT-001', 'Xe tải 5 tấn thùng 6 m', 600, 240, 250, 5000, 'VEHICLE-001'],
    ['VT-002', 'Xe tải 9,5 tấn thùng 7,2 m', 720, 235, 240, 9500, 'VEHICLE-002'],
    ['VT-003', 'Xe tải 5,5 tấn thùng 5,7 m', 570, 210, 215, 5500, 'VEHICLE-003'],
    ['VT-004', 'Xe tải đông lạnh 6 tấn thùng 6 m', 600, 210, 200, 6000, 'VEHICLE-004'],
    ['VT-005', 'Xe tải 3,5 tấn thùng 5,2 m', 520, 200, 200, 3500, 'VEHICLE-005'],
    ['VT-006', 'Xe tải 7 tấn thùng 6,1 m', 610, 215, 215, 7000, 'VEHICLE-006'],
    ['VT-007', 'Xe tải 9 tấn thùng 8,5 m', 850, 240, 250, 9000, 'VEHICLE-007'],
  ]
  return {
    vehicleTypes: types.map(([id, name, cargoLengthCm, cargoWidthCm, cargoHeightCm, payloadKg]) => ({ id, name, cargoLengthCm, cargoWidthCm, cargoHeightCm, payloadKg, createdAt })),
    vehicleTypeOf: types.map(([id, , , , , , vehicleId]) => [vehicleId, id]),
  }
}
