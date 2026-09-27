/**
 * Hàng đợi chờ duyệt `/duyet` và quyết định của quản lý công ty (luồng 4 Review 1, LM-104). `decisions` key trùng
 * `REVIEW_DECISION_KINDS` của kho; nhật ký cũng tra ở đây. `notice` là câu kể một quyết định — dùng ở Planner (dòng dưới thanh trên)
 * và Thiết lập tối ưu (banner cho điều phối). `decide` là thanh quyết định trong Planner và các hộp thoại của nó.
 */
export const review = {
  title: 'Chờ duyệt',
  count: { one: '{count} phương án chờ duyệt', other: '{count} phương án chờ duyệt' },
  empty: 'Không có phương án nào chờ duyệt.',
  emptyDescription: 'Khi điều phối viên chạy tối ưu xong, phương án mới hiện ở đây để bạn xem và duyệt.',
  decisions: {
    rejected: 'Từ chối',
    reoptimize_requested: 'Yêu cầu tối ưu lại',
    change_vehicle_suggested: 'Đề xuất đổi xe',
    split_trip_suggested: 'Đề xuất tách chuyến',
  },
  /** Chip số phận của phương án (bảng lần chạy, quyết định gần đây). */
  states: {
    approved: 'Đã duyệt',
    pending: 'Chờ duyệt',
    rejected: 'Bị từ chối',
    reoptimize_requested: 'Cần tối ưu lại',
    change_vehicle_suggested: 'Đề xuất đổi xe',
    split_trip_suggested: 'Đề xuất tách chuyến',
  },
  /** Thẻ phương án trong hàng đợi. */
  card: {
    date: 'Lịch chạy',
    scheduled: 'Ngày {date}',
    stops: { one: '{count} điểm giao', other: '{count} điểm giao' },
    vehicle: 'Xe',
    run: 'Lần chạy',
    volume: 'Thể tích',
    payload: 'Tải trọng',
    unplaced: 'Chưa xếp',
    unplacedValue: { one: '{count} kiện', other: '{count} kiện' },
    notes: 'Ghi chú',
    /** Từ thiết lập của lần chạy (`request.settings.enforceLifo`) — không phải kết quả kiểm LIFO. */
    lifoOn: 'Chạy với yêu cầu thứ tự dỡ theo điểm giao (LIFO)',
    lifoOff: 'Chạy không bắt buộc thứ tự dỡ (LIFO)',
    axle: 'Tải trục: sẽ có sau',
    submittedBy: 'Chạy bởi {name}',
    unknownRunner: 'Không rõ người chạy',
    age: {
      justNow: 'vừa gửi',
      minutes: { one: 'chờ {count} phút', other: 'chờ {count} phút' },
      hours: { one: 'chờ {count} giờ', other: 'chờ {count} giờ' },
      days: { one: 'chờ {count} ngày', other: 'chờ {count} ngày' },
    },
    open: 'Xem & duyệt',
    openFor: 'Xem và duyệt phương án của {trip}',
    compare: 'So sánh',
    compareFor: 'So sánh {count} phương án của {trip}',
  },
  recent: {
    title: 'Quyết định gần đây',
    description: 'Phương án bạn đã trả lại cho điều phối viên.',
    empty: 'Chưa có quyết định nào.',
  },
  /** Câu kể quyết định mới nhất trên phương án. */
  notice: {
    rejected: 'Quản lý công ty đã từ chối phương án này.',
    reoptimize_requested: 'Quản lý công ty yêu cầu tối ưu lại.',
    change_vehicle_suggested: 'Quản lý công ty đề xuất đổi xe.',
    split_trip_suggested: 'Quản lý công ty đề xuất tách chuyến.',
    byLine: '{name} · {time} {date}',
    reason: 'Lý do: {reason}',
    suggestedVehicle: 'Xe đề xuất: {vehicle}',
    someone: 'Quản lý công ty',
  },
  decide: {
    reject: 'Từ chối',
    more: 'Quyết định khác',
    reoptimize: 'Yêu cầu tối ưu lại',
    suggest: 'Đề xuất đổi xe / tách chuyến',
    reason: 'Lý do',
    note: 'Ghi chú',
    reasonHint: 'Điều phối viên đọc được lý do này ở Planner và Thiết lập tối ưu.',
    reasonRequired: 'Nhập lý do.',
    reasonTooLong: 'Tối đa 500 ký tự.',
    kind: 'Đề xuất',
    kinds: { change_vehicle: 'Đổi xe', split_trip: 'Tách chuyến' },
    vehicle: 'Xe đề xuất',
    vehicleHint: 'Không bắt buộc.',
    anyVehicle: 'Không chỉ định xe',
    cancel: 'Huỷ',
    dialogs: {
      reject: { title: 'Từ chối phương án?', description: 'Phương án rời hàng đợi chờ duyệt và không được duyệt nữa. Điều phối viên chạy tối ưu lại.', submit: 'Từ chối' },
      reoptimize: { title: 'Yêu cầu tối ưu lại', description: 'Phương án rời hàng đợi; điều phối viên chạy lại theo yêu cầu của bạn.', submit: 'Gửi yêu cầu' },
      suggest: { title: 'Đề xuất đổi xe hoặc tách chuyến', description: 'Phương án rời hàng đợi; điều phối viên đổi xe hoặc tách chuyến rồi tối ưu lại.', submit: 'Gửi đề xuất' },
    },
    done: {
      rejected: 'Đã từ chối phương án.',
      reoptimize_requested: 'Đã gửi yêu cầu tối ưu lại.',
      change_vehicle_suggested: 'Đã gửi đề xuất đổi xe.',
      split_trip_suggested: 'Đã gửi đề xuất tách chuyến.',
    },
  },
} as const
