import type { Permission } from '@/features/auth/permissions'
import type { Package, PackageFlag } from '@/lib/mock-db'
import type { PackageLookup } from './package-pool-api'

/**
 * Màn Tra cứu kiện `/tra-cuu-kien` (FE-3b-06): màn hiện gì với một lần tra, và mỗi vai trò làm được gì trên kiện tìm thấy. Hàm thuần
 * để test không cần React. Tham số URL: `ma` là mã đang tra (mã QR, mã của bên gửi, mã của kho), `kien` là kiện đã chọn khi nhiều kiện
 * trùng mã của bên gửi.
 */
export const CODE_PARAM = 'ma'
export const PICK_PARAM = 'kien'

export type LookupView =
  | { readonly kind: 'idle' }
  | { readonly kind: 'pending' }
  /** Mã không khớp kiện nào của công ty — kể cả khi đó là kiện của công ty khác (D-64). */
  | { readonly kind: 'notFound'; readonly code: string }
  | { readonly kind: 'many'; readonly code: string; readonly items: readonly PackageLookup[] }
  /** `fromMany`: kiện được chọn trong danh sách trùng mã — có lối quay lại danh sách. */
  | { readonly kind: 'one'; readonly item: PackageLookup; readonly fromMany: boolean }

export function lookupView({ code, pickedId, pending, notFound, data }: {
  code: string
  pickedId: string | null
  pending: boolean
  notFound: boolean
  data: readonly PackageLookup[] | undefined
}): LookupView {
  if (code === '') return { kind: 'idle' }
  if (notFound) return { kind: 'notFound', code }
  if (pending || data === undefined) return { kind: 'pending' }
  const [first] = data
  if (first === undefined) return { kind: 'notFound', code }
  if (data.length === 1) return { kind: 'one', item: first, fromMany: false }
  const picked = data.find((item) => item.package.id === pickedId)
  return picked ? { kind: 'one', item: picked, fromMany: true } : { kind: 'many', code, items: data }
}

export type LookupActions = {
  /** In lại nhãn — giữ nguyên mã QR (D-71). */
  readonly reprint: boolean
  readonly openInPool: boolean
  readonly openTrip: boolean
  /** Cờ người xem gỡ được: điều phối viên gỡ mọi cờ. */
  readonly clearFlags: readonly PackageFlag[]
  /** Nhân viên kho xác nhận đã tìm thấy kiện đang mang cờ "Không tìm thấy" (D-92). */
  readonly confirmFound: boolean
}

export function lookupActions(pkg: Pick<Package, 'flags' | 'tripId'>, can: (permission: Permission) => boolean): LookupActions {
  return {
    reprint: can('labels.print'),
    openInPool: can('packages.view'),
    openTrip: can('trips.view') && pkg.tripId !== undefined,
    clearFlags: can('packages.manage') ? pkg.flags : [],
    confirmFound: can('warehouse.operate') && pkg.flags.includes('NOT_FOUND'),
  }
}
