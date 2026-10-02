import { matchesQuery } from '@/lib/list-filter'
import { REGISTERED_PACKAGE_STATUSES, type PackageType, type RegisteredPackage, type RegisteredPackageStatus } from '@/lib/mock-db'

/**
 * Danh sách kiện đã đăng ký `/kien-hang` (LM-104): ghép loại kiện, tab trạng thái giữ trên URL (`trang-thai`, slug không dấu), tìm
 * bỏ dấu và chọn kiện để in nhãn. Hàm thuần để test không cần React.
 */
export type PackageRow = RegisteredPackage & { readonly type: PackageType | undefined }

export const STATUS_FILTER = 'trang-thai'

/** Slug trên URL của từng trạng thái (D-52: tham số tiếng Việt không dấu). */
export const PACKAGE_STATUS_SLUGS: Readonly<Record<RegisteredPackageStatus, string>> = {
  registered: 'da-dang-ky',
  received: 'da-nhan',
  planned: 'da-len-ke-hoach',
  loaded: 'da-len-xe',
  delivered: 'da-giao',
}

export type PackageTab = 'all' | RegisteredPackageStatus
export const PACKAGE_TABS: readonly PackageTab[] = ['all', ...REGISTERED_PACKAGE_STATUSES]

export function tabFromSlug(slug: string): PackageTab {
  return REGISTERED_PACKAGE_STATUSES.find((status) => PACKAGE_STATUS_SLUGS[status] === slug) ?? 'all'
}

export function slugFromTab(tab: PackageTab): string {
  return tab === 'all' ? '' : PACKAGE_STATUS_SLUGS[tab]
}

export function packageRows(packages: readonly RegisteredPackage[], types: readonly PackageType[]): PackageRow[] {
  const typeById = new Map(types.map((type) => [type.id, type]))
  return packages.map((pkg) => ({ ...pkg, type: typeById.get(pkg.packageTypeId) }))
}

/** Tìm theo mã kiện, tên / mã loại kiện, mã lô / SKU và mã QR. */
export function searchPackages(rows: readonly PackageRow[], query: string): PackageRow[] {
  if (query.trim() === '') return [...rows]
  return rows.filter((row) => matchesQuery([row.id, row.type?.name, row.packageTypeId, row.reference, row.qrToken], query))
}

export function filterByTab(rows: readonly PackageRow[], tab: PackageTab): PackageRow[] {
  return tab === 'all' ? [...rows] : rows.filter((row) => row.status === tab)
}

/** Số kiện mỗi tab (theo ô tìm, không theo tab). */
export function tabCounts(rows: readonly PackageRow[]): Record<PackageTab, number> {
  const counts = Object.fromEntries(PACKAGE_TABS.map((tab) => [tab, 0])) as Record<PackageTab, number>
  for (const row of rows) {
    counts.all += 1
    counts[row.status] += 1
  }
  return counts
}

/** Mã đã chọn theo đúng thứ tự danh sách (URL nhãn in theo thứ tự này), bỏ mã không còn trong kho. */
export function orderedSelection(rows: readonly PackageRow[], selected: ReadonlySet<string>): string[] {
  return rows.filter((row) => selected.has(row.id)).map((row) => row.id)
}

/** Đường dẫn trang in nhãn của các kiện `ids` (theo thứ tự). */
export function labelsPath(ids: readonly string[]): string {
  return `/kien-hang/nhan?kien=${ids.join(',')}`
}
