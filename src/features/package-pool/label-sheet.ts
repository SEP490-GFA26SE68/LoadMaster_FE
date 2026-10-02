import type { LabelSelection } from './package-pool-api'
import { lookupPath } from './packages-list'

/**
 * Khổ nhãn in và tham số của trang in nhãn `/kien-hang/nhan` (FE-3b-05, D-71). Hàm thuần để test không cần React.
 *
 * Tờ in: A4 dọc, lề 10 mm, bốn nhãn mỗi trang (2 × 2, khe 4 mm) — mỗi nhãn 93 × 134 mm. Mọi cỡ trong nhãn tính bằng `em` của cỡ chữ
 * gốc `baseMm`; bản xem trên màn đặt gốc 16 px nên hai bản cùng một bố cục, chỉ khác tỷ lệ. Khổ nhãn PDF của backend chưa chốt.
 */
export type LabelSheet = {
  readonly pageWidthMm: number
  readonly pageHeightMm: number
  readonly marginMm: number
  readonly gapMm: number
  readonly columns: number
  readonly rows: number
  readonly labelWidthMm: number
  readonly labelHeightMm: number
  /** Cỡ chữ gốc của nhãn trên giấy. */
  readonly baseMm: number
}

export const LABEL_SHEET: LabelSheet = {
  pageWidthMm: 210, pageHeightMm: 297, marginMm: 10, gapMm: 4, columns: 2, rows: 2, labelWidthMm: 93, labelHeightMm: 134, baseMm: 4,
}

/** Các nhãn của một trang, cộng khe và lề, nằm gọn trong khổ giấy. */
export function sheetFits(sheet: LabelSheet): boolean {
  const used = (count: number, sizeMm: number) => count * sizeMm + (count - 1) * sheet.gapMm + 2 * sheet.marginMm
  return used(sheet.columns, sheet.labelWidthMm) <= sheet.pageWidthMm && used(sheet.rows, sheet.labelHeightMm) <= sheet.pageHeightMm
}

/**
 * Kiện cần in từ đường dẫn: `?chuyen=TRIP-014` là mọi kiện của chuyến; `?kien=PK-0001,PK-0002` là đúng các kiện đó (bỏ mã lặp).
 * Không có gì thì không in gì.
 */
export function labelSelection(search: URLSearchParams): LabelSelection {
  const tripId = search.get('chuyen')?.trim()
  if (tripId) return { tripId }
  const ids = [...new Set((search.get('kien') ?? '').split(',').map((id) => id.trim()).filter(Boolean))]
  return ids.length > 0 ? { ids } : {}
}

export type LabelsBack =
  | { readonly kind: 'pool'; readonly to: string }
  | { readonly kind: 'trip'; readonly to: string; readonly tripId: string }
  | { readonly kind: 'lookup'; readonly to: string }

/**
 * Đích của nút quay lại: nơi người dùng bấm in — chuyến (`?chuyen=`), Tra cứu kiện (`&tu=tra-cuu`, mở lại đúng kiện khi in một kiện),
 * không thì Kho kiện. Người không mở được đích đó (nhân viên kho không có Kho kiện, Chi tiết chuyến) về Tra cứu kiện.
 */
export function labelsBackTarget(search: URLSearchParams, can: (permission: 'packages.view' | 'trips.view') => boolean): LabelsBack {
  const selection = labelSelection(search)
  if (selection.tripId !== undefined && can('trips.view')) return { kind: 'trip', to: `/chuyen/${encodeURIComponent(selection.tripId)}`, tripId: selection.tripId }
  if (search.get('tu') === 'tra-cuu') return { kind: 'lookup', to: lookupPath(selection.ids?.length === 1 ? selection.ids[0] : undefined) }
  return can('packages.view') && selection.tripId === undefined ? { kind: 'pool', to: '/kien-hang' } : { kind: 'lookup', to: lookupPath() }
}
