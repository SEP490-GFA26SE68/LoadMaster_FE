/** Chữ dùng chung ở nhiều màn (đang tải, quay lại, đơn vị đếm). */
export const common = {
  /** Mẫu số nhiều, dùng lại ở bảng kiện và kết quả tối ưu (LM-044, LM-049). */
  packageCount: { one: '{count} kiện', other: '{count} kiện' },
  /** Nhãn điểm giao dùng chung (LM-070): `lib/stops.ts`, Planner, danh sách kiện. */
  stop: 'Điểm {number}',
  stopWithName: 'Điểm {number} · {name}',
  packageAtStop: '{id} · Điểm {stop}',
  loadingScreen: 'Đang tải màn hình',
  processing: 'Đang xử lý',
  noData: 'Chưa có dữ liệu',
  selectPlaceholder: 'Chọn…',
  backToTrips: 'Về danh sách chuyến',
  on: 'Bật',
  off: 'Tắt',
  /** Loại sự cố giao (`DeliveryIssueKind`, D-47): một nguồn cho báo sự cố của tài xế, tiến trình chuyến và nhật ký (LM-100). */
  deliveryIssueKinds: { damaged: 'Hàng hỏng', missing: 'Thiếu hàng', refused: 'Khách từ chối', other: 'Khác' },
  /** Loại sự cố cấp chuyến (`TripExceptionType`, D-87, FE-6-11): một nguồn cho hộp báo sự cố, màn Giám sát và nhật ký. */
  tripExceptionTypes: { TRAFFIC: 'Tắc đường', ACCIDENT: 'Tai nạn', ROAD_CONSTRUCTION: 'Công trình trên đường', VEHICLE_BREAKDOWN: 'Hỏng xe', OTHER: 'Khác' },
  /** Mức hạn của điểm giao theo giờ đến dự kiến (`DeadlineStatus`, FE-4b-09): chi tiết chuyến và hộp Chi tiết của Planner (FE-5b-07). */
  deadlineStatuses: { OK: 'Kịp hạn', AT_RISK: 'Sát hạn', MISSED: 'Trễ hạn dự kiến' },
  /** Loại hàng của kiện (`HandlingClass`, D-69, FE-3b-04): một nguồn cho kho kiện, nhãn, yêu cầu giao và nhật ký. */
  handlingClasses: { STANDARD: 'Thường', FRAGILE: 'Dễ vỡ', REFRIGERATED: 'Hàng lạnh', HAZARDOUS: 'Nguy hiểm', HIGH_VALUE: 'Giá trị cao' },
  /** Trạng thái kiện của kho kiện (`PackageStatus`, D-70, FE-3b-01), key trùng mã của kho. */
  packageStatuses: {
    IMPORTED: 'Đã nhập',
    ASSIGNED: 'Đã gán chuyến',
    STAGED: 'Đã soạn',
    LOADED: 'Đã xếp',
    IN_TRANSIT: 'Đang vận chuyển',
    DELIVERED: 'Đã giao',
    RETURNED: 'Hoàn trả',
  },
  /** Cờ kiện (`PackageFlag`, D-92). */
  packageFlags: { NOT_FOUND: 'Không tìm thấy', DAMAGED: 'Hư hỏng' },
  /** Đối chiếu kiện ba mức (FE-6-03, D-83): cách đối chiếu, bước của chuyến và lý do xác nhận tay — hộp đối chiếu, thẻ duyệt và nhật ký. */
  verifyMethods: { QR: 'Quét QR', CODE: 'Gõ mã', MANUAL: 'Xác nhận tay' },
  verifyContexts: { LOADING: 'Xếp hàng', UNLOADING: 'Dỡ hàng' },
  manualConfirmReasons: { LABEL_DAMAGED: 'Nhãn rách / mất', QR_UNREADABLE: 'QR không đọc được', OTHER: 'Khác' },
  /** `DataTable` (LM-085): chân bảng phân trang và trạng thái không có kết quả khớp bộ lọc. */
  table: {
    rowsPerPage: 'Số dòng mỗi trang',
    range: '{from}–{to} / {total}',
    previousPage: 'Trang trước',
    nextPage: 'Trang sau',
    noMatch: 'Không có kết quả khớp bộ lọc',
  },
  /** `FilterBar` (LM-085): thanh tìm và lọc của các màn danh sách. */
  filters: {
    region: 'Tìm và lọc',
    all: 'Tất cả',
    from: 'Từ ngày',
    to: 'Đến ngày',
    clear: 'Xoá lọc',
  },
} as const
