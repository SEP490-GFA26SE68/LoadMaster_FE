import { addDays, vnTime } from './clock'
import { cargoFromType } from './package-type-cargo'
import { randomQrToken, seededRandom } from './qr-token'
import { CARGO, CUSTOMERS, type CargoKey } from './seed-directory'
import type { SeedEvent } from './seed-progress'
import { SEED_DISPATCHER } from './seed-trips'
import type { Company, PackageType, RegisteredPackage, TransportOrder, VehicleType } from './source-types'

/**
 * Seed nguồn hàng (LM-104, FE-0-06): hai công ty logistics, danh mục loại kiện (lấy từ danh mục hàng của 15 chuyến seed), kiện đăng
 * ký kèm mã QR, hai đơn chờ gán và danh mục loại xe của đội xe. Mốc giờ neo theo ngày `today` (D-44). Mã QR sinh từ bộ số giả ngẫu
 * nhiên có hạt giống cố định: tất định, không chứa dữ liệu kiện.
 *
 * Không còn nhà sản xuất, lô hàng và luồng quét nhận (D-63), nên seed **ghi thẳng trạng thái kiện**: kiện đã ở kho là `received` (đưa
 * vào đơn được), đợt vừa đăng ký hàng chưa về là `registered`. Mọi kiện thuộc Long Bình, do điều phối viên của Long Bình đăng ký.
 */

/** Hai công ty logistics dùng app (PRD v2 mục 5.3). */
export const COMPANIES: readonly Company[] = [
  { id: 'LOG-001', name: 'Công ty TNHH Vận tải Long Bình', address: 'Kho Long Bình, 9 Đường 3A, KCN Biên Hoà 2, Đồng Nai', phone: '0251 383 6120' },
  { id: 'LOG-002', name: 'Công ty CP Giao nhận Phương Nam', address: '102 Nguyễn Văn Quỳ, P. Phú Thuận, Q.7, TP. Hồ Chí Minh', phone: '0283 773 9054' },
]

/** Công ty của mọi kiện seed — công ty của người đăng ký `SEED_DISPATCHER`. */
const SEED_OWNER = 'LOG-001'

/** Loại kiện theo danh mục hàng seed: kích thước, khối lượng, hướng đặt và xếp chồng giữ nguyên. */
const TYPE_KEYS: readonly CargoKey[] = ['nuocSuoi', 'miGoi', 'dauAn', 'suaHop', 'banhQuy', 'quatDien', 'noiComDien', 'nuocGiat']

export type SourcingSeed = {
  companies: Company[]
  packageTypes: PackageType[]
  registeredPackages: RegisteredPackage[]
  orders: TransportOrder[]
  vehicleTypes: VehicleType[]
  vehicleTypeOf: [string, string][]
}

const typeId = (key: CargoKey) => `PT-${String(TYPE_KEYS.indexOf(key) + 1).padStart(3, '0')}`

export function seedSourcing(today: string, events: SeedEvent[]): SourcingSeed {
  const on = (daysAgo: number, time: string) => vnTime(addDays(today, -daysAgo), time)
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
  /** Một đợt đăng ký `count` kiện cùng loại ở trạng thái `status`, kèm sự kiện nhật ký như `registerPackages`. */
  function register(key: CargoKey, count: number, status: 'registered' | 'received', at: string, reference: string): RegisteredPackage[] {
    const start = registeredPackages.length
    const batch = Array.from({ length: count }, (_, index): RegisteredPackage => {
      const qrToken = randomQrToken(random, (token) => tokens.has(token))
      tokens.add(qrToken)
      return {
        id: `RPK-${String(start + index + 1).padStart(4, '0')}`, packageTypeId: typeId(key), ownerCompanyId: SEED_OWNER, qrToken,
        status, reference, registeredAt: at, registeredBy: SEED_DISPATCHER,
      }
    })
    registeredPackages.push(...batch)
    events.push({ at, actorId: SEED_DISPATCHER, action: 'package.registered', target: { type: 'package', id: batch[0]?.id ?? '' }, params: { count, packageTypeId: typeId(key), lastPackageId: batch.at(-1)?.id ?? '' } })
    return batch
  }

  // Mã kiện theo thứ tự gọi: nước suối RPK-0001…0012, mì 0013…0022, sữa 0023…0028, bánh quy 0029…0034, dầu ăn 0035…0042, quạt 0043…0048.
  // 40 kiện đã ở kho: 22 kiện của hai đơn chờ gán, 18 kiện còn lại đưa vào đơn mới được. 8 thùng dầu ăn đăng ký sáng ngày neo, hàng chưa về
  // (08:05 — sau lần đăng nhập 07:50 của điều phối viên, trước lần chạy tối ưu 08:20 của chuyến chính).
  const water = register('nuocSuoi', 12, 'received', on(3, '09:00'), 'MP-NS24-0911')
  const noodles = register('miGoi', 10, 'received', on(3, '09:10'), 'MP-MG30-0911')
  register('suaHop', 6, 'received', on(1, '14:30'), 'MP-SH48-0913')
  register('banhQuy', 6, 'received', on(1, '14:40'), 'MP-BQ-0913')
  register('dauAn', 8, 'registered', on(0, '08:05'), 'MP-DA12-0914')
  register('quatDien', 6, 'received', on(2, '10:00'), 'HB-QD16-0912')

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

  return { companies: [...COMPANIES], packageTypes, registeredPackages, orders, ...seedVehicleTypes(on(40, '09:00')) }
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
