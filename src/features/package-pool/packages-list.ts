import type { HandlingClass } from '@/domain/models'
import { matchesQuery } from '@/lib/list-filter'
import { PACKAGE_FLAGS, PACKAGE_STATUSES, type Package, type PackageFlag, type PackageStatus, type PackageType } from '@/lib/mock-db'

/**
 * Danh sách kiện của kho kiện `/kien-hang` (FE-3b-03): ghép loại kiện (kiện có thể không gắn loại), tab trạng thái và ba bộ lọc giữ
 * trên URL (slug tiếng Việt không dấu, D-52), tìm bỏ dấu và chọn kiện để in nhãn. Hàm thuần để test không cần React.
 */
export type PackageRow = Package & { readonly type: PackageType | undefined }

export const STATUS_FILTER = 'trang-thai'
export const CLASS_FILTER = 'loai-hang'
export const FLAG_FILTER = 'co'
export const LINK_FILTER = 'gan'
export const PACKAGE_FILTERS = [STATUS_FILTER, CLASS_FILTER, FLAG_FILTER, LINK_FILTER] as const
export type PackageFilterName = (typeof PACKAGE_FILTERS)[number]

/** Slug trên URL của từng trạng thái. */
export const PACKAGE_STATUS_SLUGS: Readonly<Record<PackageStatus, string>> = {
  IMPORTED: 'da-nhap',
  ASSIGNED: 'da-gan-chuyen',
  STAGED: 'da-soan',
  LOADED: 'da-xep',
  IN_TRANSIT: 'dang-van-chuyen',
  DELIVERED: 'da-giao',
  RETURNED: 'hoan-tra',
}

export const HANDLING_CLASS_SLUGS: Readonly<Record<HandlingClass, string>> = {
  STANDARD: 'thuong',
  FRAGILE: 'de-vo',
  REFRIGERATED: 'hang-lanh',
  HAZARDOUS: 'nguy-hiem',
  HIGH_VALUE: 'gia-tri-cao',
}

/** Lọc cờ: một cờ cụ thể, hoặc kiện không mang cờ nào. */
export const NO_FLAG = 'none'
export type FlagChoice = PackageFlag | typeof NO_FLAG
export const FLAG_CHOICES: readonly FlagChoice[] = [...PACKAGE_FLAGS, NO_FLAG]
export const FLAG_SLUGS: Readonly<Record<FlagChoice, string>> = { NOT_FOUND: 'khong-tim-thay', DAMAGED: 'hu-hong', none: 'khong-co' }

/**
 * Đã / chưa vào yêu cầu giao (`requirementId`, FE-4b-01) hay chuyến.
 */
export const LINK_CHOICES = ['free', 'linked'] as const
export type LinkChoice = (typeof LINK_CHOICES)[number]
export const LINK_SLUGS: Readonly<Record<LinkChoice, string>> = { free: 'chua', linked: 'da-vao' }

export type PackageTab = 'all' | PackageStatus
export const PACKAGE_TABS: readonly PackageTab[] = ['all', ...PACKAGE_STATUSES]

function fromSlug<T extends string>(slugs: Readonly<Record<T, string>>, slug: string): T | undefined {
  return (Object.keys(slugs) as T[]).find((key) => slugs[key] === slug)
}

export function tabFromSlug(slug: string): PackageTab {
  return fromSlug(PACKAGE_STATUS_SLUGS, slug) ?? 'all'
}

export function slugFromTab(tab: PackageTab): string {
  return tab === 'all' ? '' : PACKAGE_STATUS_SLUGS[tab]
}

export type PackageFilters = { readonly handlingClass?: HandlingClass; readonly flag?: FlagChoice; readonly link?: LinkChoice }

/** Bộ lọc từ tham số URL; slug lạ là không lọc (như tab). */
export function filtersFromUrl(values: Readonly<Record<typeof CLASS_FILTER | typeof FLAG_FILTER | typeof LINK_FILTER, string>>): PackageFilters {
  return {
    handlingClass: fromSlug(HANDLING_CLASS_SLUGS, values[CLASS_FILTER]),
    flag: fromSlug(FLAG_SLUGS, values[FLAG_FILTER]),
    link: fromSlug(LINK_SLUGS, values[LINK_FILTER]),
  }
}

/** Mới nhất trước (kho trả theo thứ tự tạo): kiện vừa thêm, vừa nhập đứng đầu bảng. */
export function packageRows(packages: readonly Package[], types: readonly PackageType[]): PackageRow[] {
  const typeById = new Map(types.map((type) => [type.id, type]))
  return packages.map((pkg) => ({ ...pkg, type: pkg.packageTypeId === undefined ? undefined : typeById.get(pkg.packageTypeId) })).toReversed()
}

/** Kiện đã thuộc một yêu cầu giao hoặc một chuyến. */
export function isLinked(pkg: Pick<Package, 'requirementId' | 'tripId'>): boolean {
  return pkg.requirementId !== undefined || pkg.tripId !== undefined
}

/** Tìm theo mã của bên gửi, mã kiện của kho, điểm đến, mã QR, tên / mã loại kiện, mã yêu cầu giao và mã chuyến. */
export function searchPackages(rows: readonly PackageRow[], query: string): PackageRow[] {
  if (query.trim() === '') return [...rows]
  return rows.filter((row) =>
    matchesQuery([row.packageCode, row.id, row.destination, row.qrToken, row.type?.name, row.packageTypeId, row.requirementId, row.tripId], query))
}

export function filterPackages(rows: readonly PackageRow[], filters: PackageFilters): PackageRow[] {
  const { handlingClass, flag, link } = filters
  return rows.filter((row) =>
    (handlingClass === undefined || row.handlingClass === handlingClass)
    && (flag === undefined || (flag === NO_FLAG ? row.flags.length === 0 : row.flags.includes(flag)))
    && (link === undefined || isLinked(row) === (link === 'linked')))
}

export function filterByTab(rows: readonly PackageRow[], tab: PackageTab): PackageRow[] {
  return tab === 'all' ? [...rows] : rows.filter((row) => row.status === tab)
}

/** Số kiện mỗi tab (theo ô tìm và ba bộ lọc, không theo tab). */
export function tabCounts(rows: readonly PackageRow[]): Record<PackageTab, number> {
  const counts = Object.fromEntries(PACKAGE_TABS.map((tab) => [tab, 0])) as Record<PackageTab, number>
  for (const row of rows) {
    counts.all += 1
    counts[row.status] += 1
  }
  return counts
}

/** Mã đã chọn theo thứ tự tạo — cũ trước, ngược với bảng (URL nhãn in theo thứ tự này); bỏ mã không còn trong kho. */
export function orderedSelection(rows: readonly PackageRow[], selected: ReadonlySet<string>): string[] {
  return rows.filter((row) => selected.has(row.id)).map((row) => row.id).toReversed()
}

export const LABELS_PATH = '/kien-hang/nhan'
export const LOOKUP_PATH = '/tra-cuu-kien'

/** Đường dẫn trang in nhãn của các kiện `ids` (theo thứ tự). `fromLookup`: nút quay lại của trang nhãn về màn Tra cứu kiện. */
export function labelsPath(ids: readonly string[], fromLookup = false): string {
  return `${LABELS_PATH}?kien=${ids.join(',')}${fromLookup ? '&tu=tra-cuu' : ''}`
}

/** Trang in nhãn của mọi kiện kho kiện đang thuộc chuyến `tripId` (FE-3b-07). */
export function tripLabelsPath(tripId: string): string {
  return `${LABELS_PATH}?chuyen=${encodeURIComponent(tripId)}`
}

/** Màn Tra cứu kiện mở sẵn mã `code` (mã QR, mã của bên gửi hoặc mã của kho). */
export function lookupPath(code?: string): string {
  return code === undefined ? LOOKUP_PATH : `${LOOKUP_PATH}?ma=${encodeURIComponent(code)}`
}
