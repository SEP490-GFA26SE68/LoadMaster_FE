import { roundKg } from '@/domain/geometry'
import type { HandlingClass } from '@/domain/models'
import { isWithinDateRange, matchesQuery, normalizeSearchText } from '@/lib/list-filter'
import { REQUIREMENT_PRIORITIES, REQUIREMENT_STATUSES, vnDate, type DeliveryStop, type RequirementPriority, type RequirementStatus } from '@/lib/mock-db'
import type { RequirementPackage, RequirementRow } from './requirements-api'

/**
 * Phép tính thuần của màn Yêu cầu giao (FE-4b-02): lọc danh sách, nhóm kiện cho ô chọn kiện, hai cảnh báo của form (kiện khác loại
 * hàng, điểm đến ghi trong file khác điểm đến của yêu cầu) và gợi ý điểm giao khi đưa vào chuyến. Trả mã và dữ liệu, component dịch.
 */

/** Tên tham số lọc trên URL, tiếng Việt không dấu (D-52). */
export const STATUS_FILTER = 'trang-thai'
export const PRIORITY_FILTER = 'uu-tien'
export const DUE_FROM_FILTER = 'han-tu'
export const DUE_TO_FILTER = 'han-den'
export const REQUIREMENT_FILTERS = [STATUS_FILTER, PRIORITY_FILTER, DUE_FROM_FILTER, DUE_TO_FILTER] as const
export type RequirementFilterName = (typeof REQUIREMENT_FILTERS)[number]

export const REQUIREMENT_STATUS_SLUGS: Readonly<Record<RequirementStatus, string>> = {
  PENDING: 'cho-xep-chuyen',
  ASSIGNED: 'da-vao-chuyen',
  IN_TRIP: 'dang-giao',
  DELIVERED: 'da-giao',
  PARTIAL: 'giao-thieu',
}

export const REQUIREMENT_PRIORITY_SLUGS: Readonly<Record<RequirementPriority, string>> = {
  LOW: 'thap',
  NORMAL: 'binh-thuong',
  HIGH: 'cao',
  URGENT: 'khan',
}

/** Thứ tự hiện trong ô lọc và thứ tự sắp của cột: trạng thái theo vòng đời, ưu tiên từ thấp tới khẩn. */
export const REQUIREMENT_STATUS_ORDER: readonly RequirementStatus[] = REQUIREMENT_STATUSES
export const REQUIREMENT_PRIORITY_ORDER: readonly RequirementPriority[] = REQUIREMENT_PRIORITIES

export const statusFromSlug = (slug: string) => REQUIREMENT_STATUS_ORDER.find((status) => REQUIREMENT_STATUS_SLUGS[status] === slug) ?? null
export const priorityFromSlug = (slug: string) => REQUIREMENT_PRIORITY_ORDER.find((priority) => REQUIREMENT_PRIORITY_SLUGS[priority] === slug) ?? null

/**
 * Lọc theo ô tìm (bỏ dấu: mã, điểm đến, địa chỉ, ghi chú, chuyến), trạng thái hiển thị, ưu tiên và khoảng hạn — hạn so theo ngày giờ
 * Việt Nam, tính cả hai đầu. Slug lạ là không lọc.
 */
export function filterRequirementRows(rows: readonly RequirementRow[], query: string, filters: Readonly<Record<RequirementFilterName, string>>): RequirementRow[] {
  const status = statusFromSlug(filters[STATUS_FILTER])
  const priority = priorityFromSlug(filters[PRIORITY_FILTER])
  return rows.filter((row) => (status === null || row.status === status)
    && (priority === null || row.requirement.priority === priority)
    && isWithinDateRange(vnDate(new Date(row.requirement.deadline)), filters[DUE_FROM_FILTER], filters[DUE_TO_FILTER])
    && matchesQuery([row.requirement.id, row.requirement.destinationName, row.requirement.address, row.requirement.note, row.trip?.id, row.trip?.name], query))
}

export type PackageGroup = { readonly key: string; readonly name: string; readonly items: readonly RequirementPackage[] }

/**
 * Kiện chọn được, nhóm theo loại kiện (thứ tự xuất hiện), trong nhóm theo mã. Kiện không gắn loại kiện nhóm theo loại hàng; tên nhóm
 * đó do `classGroupName` đặt (nhãn loại hàng đã dịch).
 */
export function groupByType(packages: readonly RequirementPackage[], classGroupName: (handlingClass: HandlingClass) => string): PackageGroup[] {
  const groups = new Map<string, RequirementPackage[]>()
  for (const item of packages) {
    const key = item.package.packageTypeId ?? `class:${item.package.handlingClass}`
    groups.set(key, [...(groups.get(key) ?? []), item])
  }
  return [...groups].map(([key, items]) => ({
    key,
    name: items[0]?.type?.name ?? (items[0] ? classGroupName(items[0].package.handlingClass) : key),
    items: items.toSorted((a, b) => a.package.id.localeCompare(b.package.id)),
  }))
}

/** Lọc nhanh ô chọn kiện theo điểm đến ghi trong file, mã của bên gửi hoặc mã của kho (bỏ dấu). Kiện đã chọn luôn ở lại. */
export function filterPickerPackages(packages: readonly RequirementPackage[], query: string, selectedIds: readonly string[]): RequirementPackage[] {
  if (query.trim() === '') return [...packages]
  const chosen = new Set(selectedIds)
  return packages.filter(({ package: pkg }) => chosen.has(pkg.id) || matchesQuery([pkg.destination, pkg.packageCode, pkg.id], query))
}

/** Tổng khối lượng của các kiện đã chọn, theo khối lượng của từng kiện. */
export function selectedWeightKg(packages: readonly RequirementPackage[], selectedIds: readonly string[]): number {
  const chosen = new Set(selectedIds)
  return roundKg(packages.reduce((sum, item) => sum + (chosen.has(item.package.id) ? item.package.weightKg : 0), 0))
}

type Destination = { readonly destinationName: string; readonly address: string }

/** Điểm đến ghi trên kiện trùng điểm đến của yêu cầu: trùng tên, trùng địa chỉ, hoặc "tên, địa chỉ" — bỏ dấu, không kể hoa thường. */
export function sameDestination(packageDestination: string, { destinationName, address }: Destination): boolean {
  const written = normalizeSearchText(packageDestination)
  return [destinationName, address, `${destinationName}, ${address}`].some((text) => normalizeSearchText(text) === written)
}

export type PackageWarnings = {
  /** Các loại hàng của kiện đã chọn, khi có từ hai loại trở lên (theo thứ tự chọn); một loại thì rỗng. */
  readonly mixedClasses: readonly HandlingClass[]
  /** Mã kiện có điểm đến ghi trong file khác điểm đến của yêu cầu. Chưa nhập tên lẫn địa chỉ thì chưa so. */
  readonly otherDestination: readonly string[]
}

/** Hai cảnh báo của form (PRD v2 mục 8.2) — cảnh báo, vẫn lưu được. */
export function packageWarnings(packages: readonly RequirementPackage[], selectedIds: readonly string[], destination: Destination): PackageWarnings {
  const chosen = new Set(selectedIds)
  const selected = packages.filter((item) => chosen.has(item.package.id)).map((item) => item.package)
  const classes = [...new Set(selected.map((pkg) => pkg.handlingClass))]
  const named = destination.destinationName.trim() !== '' || destination.address.trim() !== ''
  return {
    mixedClasses: classes.length > 1 ? classes : [],
    otherDestination: named ? selected.filter((pkg) => !sameDestination(pkg.destination, destination)).map((pkg) => pkg.id) : [],
  }
}

/** Điểm giao có tên trùng tên điểm đến của yêu cầu (bỏ dấu, không kể hoa thường) — chọn sẵn khi đưa vào chuyến. */
export function matchingStopId(destinationName: string, stops: readonly DeliveryStop[]): string | undefined {
  const wanted = normalizeSearchText(destinationName)
  return stops.find((stop) => normalizeSearchText(stop.name) === wanted)?.id
}
