import { addDays, vnTime } from './clock'
import type { Package } from './package-model'
import { cargoFromType, handlingClassOfType } from './package-type-cargo'
import { seededRandom } from './qr-token'
import { CARGO, CUSTOMERS, type CargoKey } from './seed-directory'
import { LONG_BINH_DEPOT, PHUONG_NAM_DEPOT } from './seed-depots'
import { LONG_BINH_IMPORT, packageSeeder } from './seed-packages'
import type { SeedEvent } from './seed-progress'
import type { DeliveryRequirement } from './requirement-model'
import { LONG_BINH_DESTINATIONS, seedRequirements } from './seed-requirements'
import { SEED_DISPATCHER } from './seed-trips'
import { LONG_BINH, PHUONG_NAM } from './seed-users'
import type { Company, PackageType, VehicleType } from './source-types'

/**
 * Seed nguồn hàng (LM-104, FE-0-06): hai công ty logistics, và của **Long Bình**: danh mục loại kiện (lấy từ danh mục hàng của 15
 * chuyến seed), kho kiện kèm mã QR, sáu yêu cầu giao chờ xếp chuyến (FE-4b-01) và danh mục loại xe của đội xe. Mốc giờ neo theo ngày `today` (D-44). Mã QR
 * sinh từ bộ số giả ngẫu nhiên có hạt giống cố định: tất định, không chứa dữ liệu kiện. Nguồn hàng của Phương Nam: `seed-phuong-nam.ts`.
 *
 * Kho kiện của Long Bình (FE-3b-01): 48 kiện thêm tay theo loại kiện (kiện đăng ký `RPK` của Review 1 chuyển sang, kích thước lấy từ
 * loại kiện) và 40 kiện nhập file chưa vào chuyến nào (`LONG_BINH_IMPORT`). Mọi kiện ở `IMPORTED`, do điều phối viên của Long Bình
 * tạo; 30 kiện thuộc sáu yêu cầu giao do quản lý công ty lập.
 */

/**
 * Hai công ty logistics dùng app (PRD v2 mục 5.3, D-64), mỗi công ty một kho xuất phát (`seed-depots.ts`).
 */
export const COMPANIES: readonly Company[] = [
  {
    id: LONG_BINH, name: 'Công ty TNHH Vận tải Long Bình', address: 'Kho Long Bình, 9 Đường 3A, KCN Biên Hoà 2, Đồng Nai', phone: '0251 383 6120',
    depot: LONG_BINH_DEPOT,
  },
  {
    id: PHUONG_NAM, name: 'Công ty CP Giao nhận Phương Nam', address: '102 Nguyễn Văn Quỳ, P. Phú Thuận, Q.7, TP. Hồ Chí Minh', phone: '0283 773 9054',
    depot: PHUONG_NAM_DEPOT,
  },
]

/** Công ty của mọi bản ghi ở file này — công ty của người đăng ký `SEED_DISPATCHER`. */
const SEED_OWNER = LONG_BINH

/** Quản lý công ty của Long Bình (`quanly@loadmaster.vn`): người lập yêu cầu giao của seed. */
export const SEED_MANAGER = 'US-0002'

/** Loại kiện theo danh mục hàng seed: kích thước, khối lượng, hướng đặt và xếp chồng giữ nguyên. */
const TYPE_KEYS: readonly CargoKey[] = ['nuocSuoi', 'miGoi', 'dauAn', 'suaHop', 'banhQuy', 'quatDien', 'noiComDien', 'nuocGiat']

export type SourcingSeed = {
  companies: Company[]
  packageTypes: PackageType[]
  packages: Package[]
  requirements: DeliveryRequirement[]
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
      id: typeId(key), companyId: SEED_OWNER, name: cargo.name, lengthCm: cargo.lengthCm, widthCm: cargo.widthCm, heightCm: cargo.heightCm, weightKg: cargo.weightKg,
      fragilityLevel: cargo.fragilityLevel, allowedOrientations: cargo.allowedOrientations, keepUpright: cargo.keepUpright, stackable: cargo.stackable,
      maxTopLoadKg: cargo.maxTopLoadKg, ...(cargo.maxStackCount === undefined ? {} : { maxStackCount: cargo.maxStackCount }), createdAt: on(30, '09:00'),
    }
  })

  const seeder = packageSeeder({
    companyId: SEED_OWNER, actorId: SEED_DISPATCHER, random, tokens, events,
    idOf: (order) => `PK-${String(order).padStart(4, '0')}`,
  })
  /** Một đợt `count` kiện thêm tay theo loại kiện `key`: kích thước, khối lượng của loại kiện; mã của bên gửi theo mã lô `reference`. */
  function register(key: CargoKey, count: number, at: string, reference: string, destination: string): Package[] {
    const type = CARGO[key]
    return seeder.add([{
      codePrefix: reference, count, destination, lengthCm: type.lengthCm, widthCm: type.widthCm, heightCm: type.heightCm, weightKg: type.weightKg,
      handlingClass: handlingClassOfType(type), packageTypeId: typeId(key),
    }], 'MANUAL', at)
  }

  // Mã kiện theo thứ tự gọi: nước suối PK-0001…0012, mì 0013…0022, sữa 0023…0028, bánh quy 0029…0034, dầu ăn 0035…0042, quạt 0043…0048,
  // rồi 40 kiện nhập file PK-0049…0088. 22 kiện đầu thuộc hai yêu cầu giao lập sáng ngày neo (điểm đến là địa chỉ khách); hai kiện cuối
  // của bốn đợt nhập đi Đà Nẵng, Huế, Hà Nội, Cần Thơ thuộc bốn yêu cầu lập chiều hôm trước; còn lại đưa vào yêu cầu mới được, trừ hai
  // kiện mang cờ. 8 thùng dầu ăn thêm sáng ngày neo (08:05 — sau lần đăng nhập 07:50 của điều phối viên, trước lần chạy
  // tối ưu 08:20 của chuyến chính).
  const water = register('nuocSuoi', 12, on(3, '09:00'), 'MP-NS24-0911', CUSTOMERS.coopBinhDuong.address)
  const noodles = register('miGoi', 10, on(3, '09:10'), 'MP-MG30-0911', CUSTOMERS.bhxDiAn.address)
  register('suaHop', 6, on(1, '14:30'), 'MP-SH48-0913', 'KCN Sóng Thần 2, TP. Dĩ An, Bình Dương')
  register('banhQuy', 6, on(1, '14:40'), 'MP-BQ-0913', 'KCN Tân Bình, Q. Tân Phú, TP. Hồ Chí Minh')
  register('dauAn', 8, on(0, '08:05'), 'MP-DA12-0914', 'KCN Mỹ Xuân A, TX. Phú Mỹ, Bà Rịa – Vũng Tàu')
  register('quatDien', 6, on(2, '10:00'), 'HB-QD16-0912', 'KCN Long Hậu, H. Cần Giuộc, Long An')
  const imported = seeder.add(LONG_BINH_IMPORT, 'IMPORT', on(1, '16:20'))
  for (const pkg of imported) {
    const flag = pkg.flags[0]
    if (flag === undefined) continue
    events.push({ at: on(1, '17:05'), actorId: SEED_DISPATCHER, action: 'package.flagged', target: { type: 'package', id: pkg.id }, params: { flag } })
    pkg.history.push({ at: on(1, '17:05'), actorId: SEED_DISPATCHER, kind: 'flagged', flag })
  }

  // Hai kiện cuối của đợt nhập đi `destination`
  const lastTwo = (destination: string) => imported.filter((pkg) => pkg.destination === destination).slice(-2)
  const { hoaKhanh, phuBai, thangLong, traNoc, coopBinhDuong, bhxDiAn } = LONG_BINH_DESTINATIONS
  const customer = (key: 'coopBinhDuong' | 'bhxDiAn') => ({ destinationName: CUSTOMERS[key].name, address: CUSTOMERS[key].address })
  // REQ-006 giao tới Bách Hoá Xanh Dĩ An — điểm 2 của chuyến nháp TRIP-014 (chạy sau ngày neo hai ngày), đưa thẳng vào chuyến được
  const requirements = seedRequirements({
    companyId: SEED_OWNER, actorId: SEED_MANAGER, today, events,
    specs: [
      { id: 'REQ-001', ...hoaKhanh, due: [4, '17:00'], priority: 'LOW', packages: lastTwo(hoaKhanh.address), createdAt: on(1, '16:40') },
      { id: 'REQ-002', ...phuBai, due: [3, '17:00'], priority: 'HIGH', packages: lastTwo(phuBai.address), createdAt: on(1, '16:45'), note: 'Hàng gốm, giao trong giờ hành chính' },
      { id: 'REQ-003', ...thangLong, due: [5, '12:00'], priority: 'URGENT', packages: lastTwo(thangLong.address), createdAt: on(1, '16:50') },
      { id: 'REQ-004', ...traNoc, due: [3, '10:00'], priority: 'NORMAL', packages: lastTwo(traNoc.address), createdAt: on(1, '16:55') },
      { id: 'REQ-005', ...customer('coopBinhDuong'), ...coopBinhDuong, due: [2, '16:00'], priority: 'NORMAL', packages: water, createdAt: on(0, '08:40') },
      { id: 'REQ-006', ...customer('bhxDiAn'), ...bhxDiAn, due: [2, '11:00'], priority: 'HIGH', packages: noodles, createdAt: on(0, '08:45') },
    ],
  })

  return { companies: [...COMPANIES], packageTypes, packages: seeder.packages, requirements, ...seedVehicleTypes(on(40, '09:00')) }
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
    vehicleTypes: types.map(([id, name, cargoLengthCm, cargoWidthCm, cargoHeightCm, payloadKg]) => ({ id, companyId: SEED_OWNER, name, cargoLengthCm, cargoWidthCm, cargoHeightCm, payloadKg, createdAt })),
    vehicleTypeOf: types.map(([id, , , , , , vehicleId]) => [vehicleId, id]),
  }
}
