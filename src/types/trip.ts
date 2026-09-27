/**
 * Trạng thái chuyến hiển thị và dùng để lọc/nhóm (LM-104, quyết định 27/09/2026): năm trạng thái của backend (`DRAFT`, `OPTIMIZED`,
 * `APPROVED`, `IN_TRANSIT`, `COMPLETED`) cộng Đã huỷ. Pha vận hành chi tiết (kho đang xếp, đã xếp xong) và phương án lỗi thời là
 * dòng phụ (`TripSubStatus`), không phải trạng thái.
 */
export type TripStatus =
  | 'nhap'
  | 'da_toi_uu'
  | 'da_duyet'
  | 'dang_van_chuyen'
  | 'hoan_thanh'
  | 'da_huy'

/**
 * Dòng phụ dưới chip trạng thái (LM-104): phương án đang hiển thị lỗi thời (cần tối ưu lại), kho đang xếp (đã ghi / tổng kiện của
 * phương án kho xếp theo), hoặc kho đã xếp xong chờ xe chạy.
 */
export type TripSubStatus =
  | { readonly kind: 'stale' }
  | { readonly kind: 'loading'; readonly recorded: number; readonly total: number }
  | { readonly kind: 'loaded' }
