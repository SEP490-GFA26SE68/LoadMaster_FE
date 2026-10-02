import type { Permission } from '@/features/auth/permissions'
import { matchesQuery, normalizeSearchText } from '@/lib/list-filter'
import type { Role } from '@/types/user'

/**
 * Tìm nhanh Ctrl+K (LM-099, D-55): chuyến, kiện, xe, người dùng; thêm cho Review 1 (LM-104): kho kiện, loại kiện, và yêu cầu giao thay đơn hàng (FE-4b-02; kho kiện
 * theo `packages.view` — điều phối viên và quản lý công ty, FE-3b-03; loại kiện của điều phối viên). Hàm thuần: `search-api.ts` đọc
 * kho, màn gọi `searchSources` mỗi lần gõ. Tìm không phân biệt dấu và hoa thường, mọi từ phải có (`matchesQuery` của danh sách, LM-085).
 */
export const SEARCH_GROUPS = ['trips', 'packages', 'requirements', 'pool', 'packageTypes', 'vehicles', 'users'] as const
export type SearchGroup = (typeof SEARCH_GROUPS)[number]

/**
 * Quyền để thấy một nhóm — trùng quyền mở màn đích (`role-routes.dom.test.tsx` kiểm với bảng route thật). Kiện mở trong chi tiết chuyến
 * nên theo quyền xem chuyến. Theo tám vai trò (FE-0-04): quản trị hệ thống và quản trị công ty tìm người dùng; quản lý công ty tìm
 * chuyến, kiện, yêu cầu giao, kho kiện, xe; điều phối viên thêm loại kiện; bốn vai trò còn lại không có nhóm nào.
 */
export const GROUP_PERMISSION: Readonly<Record<SearchGroup, Permission>> = {
  trips: 'trips.view',
  packages: 'trips.view',
  requirements: 'requirements.view',
  pool: 'packages.view',
  packageTypes: 'packages.manage',
  vehicles: 'fleet.view',
  users: 'users.manage',
}

/** Nhóm người đăng nhập được tìm, theo thứ tự hiện. */
export function searchGroupsFor(can: (permission: Permission) => boolean): SearchGroup[] {
  return SEARCH_GROUPS.filter((group) => can(GROUP_PERMISSION[group]))
}

export const RESULTS_PER_GROUP = 8

export type SearchSources = {
  readonly trips: readonly {
    readonly id: string
    readonly name: string
    /** Tên các điểm giao. */
    readonly stops: readonly string[]
    /** Mã kiện gốc của chuyến. */
    readonly packageIds: readonly string[]
  }[]
  readonly vehicles: readonly { readonly id: string; readonly name: string }[]
  readonly users: readonly { readonly id: string; readonly fullName: string; readonly email: string; readonly role: Role }[]
  readonly requirements: readonly { readonly id: string; readonly destinationName: string; readonly address: string }[]
  /** Kiện của kho kiện: mã của kho, mã của bên gửi, mã QR, tên loại kiện (kiện không gắn loại thì điểm đến). */
  readonly pool: readonly { readonly id: string; readonly reference?: string; readonly qrToken: string; readonly typeName: string }[]
  readonly packageTypes: readonly { readonly id: string; readonly name: string }[]
}

type ResultBase = { readonly key: string; readonly href: string; readonly id: string }

export type SearchResult =
  | (ResultBase & { readonly group: 'trips'; readonly name: string })
  | (ResultBase & { readonly group: 'packages'; readonly tripId: string; readonly tripName: string })
  | (ResultBase & { readonly group: 'vehicles'; readonly name: string })
  | (ResultBase & { readonly group: 'users'; readonly name: string; readonly email: string; readonly role: Role })
  | (ResultBase & { readonly group: 'requirements'; readonly name: string; readonly detail: string })
  | (ResultBase & { readonly group: 'pool'; readonly name: string; readonly reference?: string })
  | (ResultBase & { readonly group: 'packageTypes'; readonly name: string })

export type SearchResultGroup = { readonly group: SearchGroup; readonly results: readonly SearchResult[] }

const path = (value: string) => encodeURIComponent(value)

/**
 * Kết quả theo nhóm, đúng thứ tự `groups` (chỉ nhóm người dùng được xem), mỗi nhóm tối đa `RESULTS_PER_GROUP` theo thứ tự của kho;
 * nhóm không có kết quả thì bỏ. Từ khoá rỗng: không có kết quả nào.
 * - Chuyến: mã, tên, tên điểm giao → chi tiết chuyến.
 * - Kiện: mã kiện gốc → chi tiết chuyến mở đúng kiện (`?kien=`, LM-047).
 * - Xe: mã, tên (tên xe gồm biển số) → chi tiết xe.
 * - Người dùng: họ tên, email, mã → danh sách người dùng lọc đúng mã.
 * - Yêu cầu giao: mã, điểm đến, địa chỉ → danh sách yêu cầu lọc đúng mã. Kho kiện: mã, mã của bên gửi, mã QR, tên loại hoặc điểm đến → kho kiện lọc
 *   đúng mã. Loại kiện: mã, tên → danh sách loại lọc đúng mã.
 */
export function searchSources(sources: SearchSources, query: string, groups: readonly SearchGroup[]): SearchResultGroup[] {
  if (normalizeSearchText(query) === '') return []
  const matchers: Record<SearchGroup, () => SearchResult[]> = {
    trips: () =>
      sources.trips
        .filter((trip) => matchesQuery([trip.id, trip.name, ...trip.stops], query))
        .map((trip) => ({ group: 'trips', key: `trip:${trip.id}`, href: `/chuyen/${path(trip.id)}`, id: trip.id, name: trip.name })),
    packages: () =>
      sources.trips.flatMap((trip) =>
        trip.packageIds
          .filter((packageId) => matchesQuery(packageId, query))
          .map((packageId) => ({
            group: 'packages', key: `package:${trip.id}:${packageId}`, href: `/chuyen/${path(trip.id)}?kien=${path(packageId)}`,
            id: packageId, tripId: trip.id, tripName: trip.name,
          })),
      ),
    vehicles: () =>
      sources.vehicles
        .filter((vehicle) => matchesQuery([vehicle.id, vehicle.name], query))
        .map((vehicle) => ({ group: 'vehicles', key: `vehicle:${vehicle.id}`, href: `/doi-xe/${path(vehicle.id)}`, id: vehicle.id, name: vehicle.name })),
    users: () =>
      sources.users
        .filter((user) => matchesQuery([user.fullName, user.email, user.id], query))
        .map((user) => ({
          group: 'users', key: `user:${user.id}`, href: `/nguoi-dung?q=${path(user.id)}`,
          id: user.id, name: user.fullName, email: user.email, role: user.role,
        })),
    requirements: () =>
      sources.requirements
        .filter((requirement) => matchesQuery([requirement.id, requirement.destinationName, requirement.address], query))
        .map((requirement) => ({
          group: 'requirements', key: `requirement:${requirement.id}`, href: `/yeu-cau-giao?q=${path(requirement.id)}`,
          id: requirement.id, name: requirement.destinationName, detail: requirement.address,
        })),
    pool: () =>
      sources.pool
        .filter((pkg) => matchesQuery([pkg.id, pkg.reference ?? '', pkg.qrToken, pkg.typeName], query))
        .map((pkg) => ({
          group: 'pool', key: `pool:${pkg.id}`, href: `/kien-hang?q=${path(pkg.id)}`,
          id: pkg.id, name: pkg.typeName, reference: pkg.reference,
        })),
    packageTypes: () =>
      sources.packageTypes
        .filter((type) => matchesQuery([type.id, type.name], query))
        .map((type) => ({ group: 'packageTypes', key: `package-type:${type.id}`, href: `/loai-kien?q=${path(type.id)}`, id: type.id, name: type.name })),
  }
  return groups
    .map((group) => ({ group, results: matchers[group]().slice(0, RESULTS_PER_GROUP) }))
    .filter((entry) => entry.results.length > 0)
}

/** Một đoạn của chữ hiển thị: `match` là phần khớp từ khoá, tô để người dùng thấy vì sao dòng này hiện ra. */
export type TextPart = { readonly text: string; readonly match: boolean }

/** Một ký tự gốc sau khi bỏ dấu như `normalizeSearchText`; khoảng trắng giữ thành một dấu cách để từ khoá không khớp qua hai từ. */
function foldChar(char: string): string {
  return /\s/.test(char) ? ' ' : normalizeSearchText(char)
}

/**
 * Tách `text` thành các đoạn khớp / không khớp theo đúng luật tìm (`matchesQuery`): bỏ dấu, không phân biệt hoa thường, mỗi từ của
 * từ khoá tô mọi chỗ nó xuất hiện. Bỏ dấu theo **từng ký tự gốc** nên vị trí tô trên chữ có dấu vẫn đúng ("hoa" tô "Hoà").
 * Từ khoá rỗng hoặc không khớp: một đoạn duy nhất không tô.
 */
export function highlightParts(text: string, query: string): TextPart[] {
  const terms = normalizeSearchText(query).split(' ').filter((term) => term !== '')
  const chars = [...text]
  const folds = chars.map(foldChar)
  // Ký tự thứ i của chữ đã bỏ dấu đến từ ký tự gốc nào
  const origin = folds.flatMap((fold, index) => [...fold].map(() => index))
  const folded = folds.join('')
  const marked = chars.map(() => false)
  for (const term of terms) {
    for (let from = folded.indexOf(term); from !== -1; from = folded.indexOf(term, from + 1)) {
      for (let i = from; i < from + term.length; i++) marked[origin[i] ?? 0] = true
    }
  }
  const parts: TextPart[] = []
  chars.forEach((char, index) => {
    // Dấu rời (chữ chưa dựng sẵn NFC) không còn gì sau khi bỏ dấu: đi theo ký tự gốc đứng trước nó
    const match = folds[index] === '' && index > 0 ? (marked[index - 1] ?? false) : (marked[index] ?? false)
    marked[index] = match
    const last = parts.at(-1)
    if (last && last.match === match) parts[parts.length - 1] = { text: last.text + char, match }
    else parts.push({ text: char, match })
  })
  return parts.length > 0 ? parts : [{ text, match: false }]
}
