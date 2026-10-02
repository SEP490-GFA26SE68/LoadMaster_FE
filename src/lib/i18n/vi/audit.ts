import type { AuditActionLabels, AuditGroup } from '@/lib/mock-db/audit'

/**
 * Nhật ký hệ thống (D-43): nhãn cho mã hành động của kho (`AUDIT_ACTIONS`) và nhóm lọc. Màn `/nhat-ky` (LM-091) và chuông thông
 * báo (LM-098) tra `audit.actions.<mã>`; tham số của sự kiện hiện riêng, không ghép vào câu.
 */
export const audit = {
  actions: {
    auth: { signedIn: 'Đăng nhập', signedOut: 'Đăng xuất', signInFailed: 'Đăng nhập không thành công' },
    vehicle: { created: 'Thêm xe', updated: 'Sửa cấu hình xe', deleted: 'Xoá xe', maintenanceOn: 'Đưa xe vào bảo dưỡng', maintenanceOff: 'Kết thúc bảo dưỡng xe' },
    trip: { created: 'Tạo chuyến', updated: 'Sửa chuyến', cancelled: 'Huỷ chuyến' },
    optimization: { saved: 'Lưu kết quả tối ưu', failed: 'Lần chạy tối ưu không ra kết quả' },
    revision: { approved: 'Duyệt phương án' },
    loading: { started: 'Bắt đầu xếp hàng', missing: 'Báo thiếu kiện ở kho', completed: 'Xếp xong', sealed: 'Ghi số seal niêm phong' },
    delivery: { started: 'Xuất phát giao hàng', issue: 'Báo sự cố giao hàng', stopCompleted: 'Hoàn tất điểm giao', completed: 'Hoàn thành chuyến' },
    user: {
      created: 'Tạo tài khoản', updated: 'Sửa tài khoản', locked: 'Khoá tài khoản', unlocked: 'Mở khoá tài khoản', deleted: 'Xoá tài khoản',
      passwordReset: 'Đặt lại mật khẩu', passwordChanged: 'Đổi mật khẩu', profileUpdated: 'Sửa hồ sơ cá nhân',
    },
    packageType: { created: 'Thêm loại kiện', updated: 'Sửa loại kiện', deleted: 'Xoá loại kiện' },
    package: { created: 'Thêm kiện vào kho kiện', importConfirmed: 'Nhập file vào kho kiện', updated: 'Sửa kiện', statusChanged: 'Chuyển trạng thái kiện', flagged: 'Gắn cờ kiện', flagCleared: 'Gỡ cờ kiện', found: 'Kho tìm thấy lại kiện' },
    requirement: { created: 'Tạo yêu cầu giao', updated: 'Sửa yêu cầu giao', deleted: 'Xoá yêu cầu giao', assigned: 'Đưa yêu cầu giao vào chuyến', unassigned: 'Gỡ yêu cầu giao khỏi chuyến' },
    vehicleType: { created: 'Thêm loại xe', updated: 'Sửa loại xe', deleted: 'Xoá loại xe', assigned: 'Gắn loại xe cho xe' },
  } satisfies AuditActionLabels,
  groups: {
    auth: 'Đăng nhập',
    vehicle: 'Đội xe',
    trip: 'Chuyến',
    optimization: 'Tối ưu',
    revision: 'Duyệt',
    loading: 'Kho',
    delivery: 'Giao hàng',
    user: 'Người dùng',
    packageType: 'Loại kiện',
    package: 'Kho kiện',
    requirement: 'Yêu cầu giao',
    vehicleType: 'Loại xe',
  } satisfies Record<AuditGroup, string>,
  /** Màn `/nhat-ky` (LM-091): bảng, bộ lọc và cách đọc tham số của sự kiện. */
  log: {
    title: 'Nhật ký hệ thống',
    count: { one: '{count} sự kiện', other: '{count} sự kiện' },
    loading: 'Đang tải nhật ký…',
    errorTitle: 'Không tải được nhật ký',
    errorDescription: 'Kho dữ liệu không trả lời. Thử lại sau giây lát.',
    retry: 'Thử lại',
    empty: 'Chưa có sự kiện nào.',
    noMatch: 'Không có sự kiện khớp bộ lọc.',
    search: 'Tìm theo mã chuyến, xe, người dùng',
    dateRange: 'Khoảng ngày',
    actor: 'Người làm',
    allActors: 'Mọi người',
    group: 'Nhóm hành động',
    allGroups: 'Mọi nhóm',
    /** Bộ lọc công ty, chỉ quản trị hệ thống có (FE-0-08); `platform` là sự kiện không thuộc công ty nào. */
    company: 'Công ty',
    allCompanies: 'Mọi công ty',
    platform: 'Nền tảng',
    /** Nhãn cạnh tiêu đề: màn không có thao tác ghi nào. */
    readOnly: 'Chỉ đọc',
    /**
     * Ba ô số liệu trên đầu màn (V2), đếm trên cả nhật ký của kho — không theo bộ lọc hay ô tìm. Ô "ngày gần nhất" là công tắc lọc
     * khoảng ngày về đúng ngày đó.
     */
    summary: {
      region: 'Tóm tắt nhật ký',
      total: 'Sự kiện trong nhật ký',
      totalNote: 'Cả nhật ký, không theo bộ lọc',
      latestDay: 'Sự kiện ngày {date}',
      latestDayNote: 'Ngày gần nhất có ghi nhận · bấm để lọc',
      latestDayNone: 'Sự kiện ngày gần nhất',
      latestAt: 'Ghi nhận gần nhất',
      latestAtNote: 'Ngày {date}',
      /** Nhật ký rỗng: không có ngày, không có giờ để hiện. */
      noEvents: 'Chưa có sự kiện',
      noValue: '—',
    },
    columns: { at: 'Thời điểm', actor: 'Người làm', action: 'Hành động', target: 'Đối tượng', details: 'Chi tiết' },
    /** Ngày giờ ghép từ hai phần đã format theo ngôn ngữ. */
    dateTime: '{time} {date}',
    /** Sự kiện không có phiên: hệ thống tự ghi, hoặc đăng nhập sai khi chưa có ai đăng nhập. */
    system: 'Hệ thống',
    anonymous: 'Chưa đăng nhập',
    deletedUser: 'Tài khoản đã xoá ({id})',
    /** Một cặp tham số trong cột Chi tiết; các cặp nối bằng dấu chấm giữa. */
    detail: '{label}: {value}',
    /** Nhãn tham số của sự kiện, key trùng tên tham số kho ghi. */
    params: {
      name: 'Tên',
      fullName: 'Họ tên',
      role: 'Vai trò',
      email: 'Email',
      fields: 'Trường đã sửa',
      reason: 'Lý do',
      note: 'Ghi chú',
      revisionId: 'Phương án',
      sourceRevisionId: 'Duyệt từ',
      placed: 'Xếp được',
      unplaced: 'Không xếp được',
      edits: 'Kiện chỉnh tay',
      loaded: 'Đã lên xe',
      missing: 'Thiếu ở kho',
      packageInstanceId: 'Kiện',
      stopNumber: 'Điểm giao',
      kind: 'Loại sự cố',
      stops: 'Số điểm giao',
      issues: 'Sự cố',
      /** Sửa đúng một giá trị (V2.3, quyết định 2): dòng kiện, trường và giá trị trước → sau. */
      packageId: 'Kiện',
      field: 'Trường',
      before: 'Trước',
      after: 'Sau',
      // LM-104
      count: 'Số kiện',
      packageTypeId: 'Loại kiện',
      lastPackageId: 'Đến kiện',
      // Kho kiện (FE-3b-01)
      packageCode: 'Mã kiện',
      flag: 'Cờ',
      destinationName: 'Điểm đến',
      priority: 'Ưu tiên',
      tripId: 'Chuyến',
      objective: 'Mục tiêu',
      algorithm: 'Thuật toán',
      reasonCode: 'Lý do',
      vehicleTypeId: 'Loại xe',
      sealNumber: 'Số seal',
    },
    /** Giá trị của tham số `fields`: tên trường chuyến, tài khoản hoặc yêu cầu giao đã sửa. */
    fieldNames: {
      name: 'Tên chuyến',
      vehicleId: 'Xe',
      stops: 'Điểm giao',
      packages: 'Kiện hàng',
      scheduledDate: 'Ngày chạy',
      driverId: 'Tài xế',
      fullName: 'Họ tên',
      email: 'Email',
      phone: 'Số điện thoại',
      role: 'Vai trò',
      depot: 'Kho / chi nhánh',
      // Yêu cầu giao (FE-4b-01)
      destinationName: 'Tên điểm đến',
      address: 'Địa chỉ',
      lat: 'Vĩ độ',
      lng: 'Kinh độ',
      deadline: 'Hạn giao',
      priority: 'Ưu tiên',
      note: 'Ghi chú',
      packageIds: 'Kiện',
    },
    /** Mã lý do đăng nhập không thành công. */
    reasons: { suspended: 'Tài khoản đã bị khoá' },
    /** Giá trị của tham số `field`: trường của một dòng kiện (`PACKAGE_CHANGE_FIELDS` của kho). */
    packageFields: {
      name: 'Tên kiện',
      lengthCm: 'Dài',
      widthCm: 'Rộng',
      heightCm: 'Cao',
      weightKg: 'Khối lượng',
      quantity: 'Số lượng',
      deliveryStop: 'Điểm giao',
      fragilityLevel: 'Mức dễ vỡ',
      maxTopLoadKg: 'Tải tối đa bên trên',
      priority: 'Ưu tiên',
    },
  },
} as const
