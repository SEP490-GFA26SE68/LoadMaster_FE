import type { HandlingClass } from '@/domain/models'
import type { Package, PackageFlag, PackageSource } from './package-model'
import { randomQrToken } from './qr-token'
import type { SeedEvent } from './seed-progress'

/**
 * Dựng kiện kho kiện cho seed (FE-3b-01): mỗi đợt là các kiện giống nhau cùng điểm đến, mã của bên gửi `<tiền tố>-NN`. Mọi kiện seed ở
 * `IMPORTED` — chưa chuyến seed nào lấy kiện từ kho kiện. Mã QR lấy từ bộ số có hạt giống của nơi gọi, không trùng mã đã cấp.
 */
export type PackageBatch = {
  /** Tiền tố mã kiện của bên gửi; kiện thứ i mang `<codePrefix>-0i`. */
  codePrefix: string
  count: number
  destination: string
  lengthCm: number
  widthCm: number
  heightCm: number
  weightKg: number
  handlingClass: HandlingClass
  packageTypeId?: string
  /** Cờ của kiện **cuối** đợt (kiện demo gỡ cờ). */
  lastFlag?: PackageFlag
}

export type PackageSeeder = {
  readonly packages: Package[]
  /** Một lần tạo (một sự kiện nhật ký) gồm một hay nhiều đợt, lúc `at`. */
  add(batches: readonly PackageBatch[], source: PackageSource, at: string): Package[]
}

export function packageSeeder(options: {
  companyId: string
  actorId: string
  /** Mã kiện thứ `order` (đếm từ 1) của công ty. */
  idOf: (order: number) => string
  random: () => number
  /** Mã QR đã cấp; mã mới được thêm vào đây. */
  tokens: Set<string>
  events: SeedEvent[]
}): PackageSeeder {
  const { companyId, actorId, idOf, random, tokens, events } = options
  const packages: Package[] = []
  return {
    packages,
    add(batches, source, at) {
      const created = batches.flatMap((batch) => Array.from({ length: batch.count }, (_, index): Package => {
        const qrToken = randomQrToken(random, (token) => tokens.has(token))
        tokens.add(qrToken)
        const flagged = batch.lastFlag !== undefined && index === batch.count - 1
        const pkg: Package = {
          id: idOf(packages.length + 1), companyId, packageCode: `${batch.codePrefix}-${String(index + 1).padStart(2, '0')}`, qrToken,
          lengthCm: batch.lengthCm, widthCm: batch.widthCm, heightCm: batch.heightCm, weightKg: batch.weightKg, handlingClass: batch.handlingClass,
          destination: batch.destination, ...(batch.packageTypeId === undefined ? {} : { packageTypeId: batch.packageTypeId }),
          status: 'IMPORTED', flags: flagged && batch.lastFlag ? [batch.lastFlag] : [], source, createdAt: at, createdBy: actorId,
          history: [{ at, actorId, kind: 'created', source }],
        }
        packages.push(pkg)
        return pkg
      }))
      const types = [...new Set(batches.flatMap((batch) => batch.packageTypeId ?? []))]
      events.push({
        at, actorId, action: source === 'IMPORT' ? 'package.importConfirmed' : 'package.created', target: { type: 'package', id: created[0]?.id ?? '' },
        params: { count: created.length, ...(types.length > 0 ? { packageTypeId: types.join(',') } : {}), lastPackageId: created.at(-1)?.id ?? '' },
      })
      return created
    },
  }
}

/**
 * 40 kiện Long Bình nhập từ một file, chưa vào đơn hay chuyến nào — để demo lập chuyến từ kho kiện. Tám điểm đến là khu công nghiệp
 * thật; đủ năm loại hàng; không kiện nào gắn loại kiện (ràng buộc xếp mặc định theo loại hàng). Hai kiện mang cờ để demo gỡ cờ.
 */
export const LONG_BINH_IMPORT: readonly PackageBatch[] = [
  { codePrefix: 'HK-DNG-2609', count: 5, destination: 'KCN Hoà Khánh, Q. Liên Chiểu, Đà Nẵng', lengthCm: 60, widthCm: 40, heightCm: 40, weightKg: 18, handlingClass: 'STANDARD' },
  { codePrefix: 'PB-HUE-2609', count: 5, destination: 'KCN Phú Bài, TX. Hương Thuỷ, Thừa Thiên Huế', lengthCm: 50, widthCm: 40, heightCm: 30, weightKg: 9.5, handlingClass: 'FRAGILE' },
  { codePrefix: 'BV-VIN-2609', count: 5, destination: 'KCN Bắc Vinh, TP. Vinh, Nghệ An', lengthCm: 80, widthCm: 60, heightCm: 50, weightKg: 32, handlingClass: 'STANDARD', lastFlag: 'NOT_FOUND' },
  { codePrefix: 'TL-HNI-2609', count: 5, destination: 'KCN Thăng Long, H. Đông Anh, Hà Nội', lengthCm: 45, widthCm: 35, heightCm: 30, weightKg: 7.2, handlingClass: 'HIGH_VALUE' },
  { codePrefix: 'TN-CTH-2609', count: 5, destination: 'KCN Trà Nóc, Q. Bình Thuỷ, Cần Thơ', lengthCm: 60, widthCm: 40, heightCm: 35, weightKg: 22, handlingClass: 'REFRIGERATED' },
  { codePrefix: 'AM-BHA-2609', count: 5, destination: 'KCN Amata, TP. Biên Hoà, Đồng Nai', lengthCm: 40, widthCm: 30, heightCm: 30, weightKg: 14, handlingClass: 'HAZARDOUS', lastFlag: 'DAMAGED' },
  { codePrefix: 'SD-KHA-2609', count: 5, destination: 'KCN Suối Dầu, H. Cam Lâm, Khánh Hoà', lengthCm: 55, widthCm: 40, heightCm: 35, weightKg: 11, handlingClass: 'STANDARD' },
  { codePrefix: 'PT-QNH-2609', count: 5, destination: 'KCN Phú Tài, TP. Quy Nhơn, Bình Định', lengthCm: 70, widthCm: 50, heightCm: 45, weightKg: 26, handlingClass: 'STANDARD' },
]
