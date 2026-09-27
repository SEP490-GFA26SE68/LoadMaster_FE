/**
 * Quản trị người dùng (LM-071, LM-092): danh sách có tìm/lọc, menu thao tác mỗi dòng, hộp thoại thêm/sửa, mật khẩu tạm, xác nhận
 * xoá, và tab "Ma trận quyền" chỉ đọc. Tên vai trò ở nhánh `roles`.
 */
export const admin = {
  users: {
    title: 'Người dùng',
    count: { one: '{count} tài khoản', other: '{count} tài khoản' },
    neverSignedIn: 'Chưa đăng nhập',
    loading: 'Đang tải danh sách người dùng…',
    errorTitle: 'Không tải được danh sách người dùng',
    errorDescription: 'Kho dữ liệu không trả lời. Thử lại sau giây lát.',
    retry: 'Thử lại',
    empty: 'Chưa có tài khoản nào.',
    noMatch: 'Không có tài khoản khớp bộ lọc.',
    tabs: { accounts: 'Tài khoản', permissions: 'Ma trận quyền' },
    /** Ba ô số liệu trên đầu tab Tài khoản (V2): đếm trên toàn bộ danh sách; nhãn hai ô trạng thái lấy từ `status`. */
    summary: {
      total: 'Tổng tài khoản',
      totalNote: 'Mọi vai trò, kể cả tài khoản đã khoá',
      note: {
        active: 'Đăng nhập được vào hệ thống',
        suspended: 'Không đăng nhập được cho tới khi mở khoá',
      },
    },
    search: 'Tìm theo tên, email, số điện thoại, mã',
    filters: { role: 'Vai trò', allRoles: 'Mọi vai trò', status: 'Trạng thái', allStatuses: 'Mọi trạng thái' },
    updated: 'Đã cập nhật {name}',
    locked: 'Đã khoá tài khoản {name}',
    unlocked: 'Đã mở khoá tài khoản {name}',
    deleted: 'Đã xoá tài khoản {name}',
    columns: {
      user: 'Người dùng',
      phone: 'Điện thoại',
      role: 'Vai trò',
      depot: 'Kho / chi nhánh',
      lastActive: 'Hoạt động gần nhất',
      status: 'Trạng thái',
      actions: 'Thao tác',
    },
    status: {
      active: 'Đang hoạt động',
      suspended: 'Đã khoá',
    },
    /** Thiết bị chính của từng vai trò — quyết định màn hình mặc định sau đăng nhập. */
    devices: {
      dispatcher: 'Máy tính',
      warehouse: 'Máy tính bảng tại kho',
      driver: 'Điện thoại',
      manager: 'Máy tính / máy tính bảng',
      admin: 'Máy tính',
      manufacturer: 'Máy tính',
      logistics: 'Điện thoại hoặc máy tính bảng tại kho',
    },
    /** Menu thao tác ở cuối mỗi dòng. */
    menu: {
      open: 'Thao tác cho {name}',
      edit: 'Sửa thông tin',
      lock: 'Khoá tài khoản',
      unlock: 'Mở khoá tài khoản',
      resetPassword: 'Đặt lại mật khẩu',
      delete: 'Xoá tài khoản',
    },
    /**
     * Panel chi tiết bên phải (V2), mở khi bấm một dòng. Nhãn trường dùng lại `columns`, nhãn nút dùng lại `menu`, tên quyền dùng
     * lại `admin.permissions.labels`.
     */
    detail: {
      region: 'Chi tiết tài khoản {name}',
      close: 'Đóng chi tiết tài khoản',
      info: 'Thông tin cá nhân',
      id: 'Mã tài khoản',
      permissions: 'Công việc được phép',
      permissionsNote: 'Quyền đi theo vai trò {role}, cùng cấu hình với tab Ma trận quyền. Đây là nhãn, không phải nút bấm.',
      actions: 'Thao tác',
    },
    /** Lý do một thao tác bị chặn trước khi gửi kho (`account-guards.ts`). */
    blocked: {
      self: 'Không áp dụng cho tài khoản bạn đang đăng nhập',
      lastAdmin: 'Hệ thống cần ít nhất một quản trị viên đang hoạt động',
    },
    form: {
      createTitle: 'Thêm người dùng',
      editTitle: 'Sửa người dùng',
      createDescription: 'Hệ thống cấp mật khẩu tạm và chỉ hiện một lần sau khi tạo.',
      editDescription: 'Sửa thông tin liên hệ, kho và vai trò của tài khoản.',
      fullName: 'Họ và tên',
      fullNamePlaceholder: 'Nguyễn Thanh Tùng',
      phone: 'Số điện thoại',
      email: 'Email',
      emailPlaceholder: 'ten@loadmaster.vn',
      depot: 'Kho / chi nhánh',
      depotPlaceholder: 'Kho Long Bình',
      role: 'Vai trò',
      device: 'Thiết bị chính: {device}',
      cancel: 'Huỷ',
      save: 'Lưu thay đổi',
      create: 'Thêm người dùng',
    },
    errors: {
      fullNameRequired: 'Nhập họ tên',
      fullNameTooLong: 'Họ tên tối đa 80 ký tự',
      emailRequired: 'Nhập email',
      emailInvalid: 'Email không đúng định dạng',
      phoneRequired: 'Nhập số điện thoại',
      phoneInvalid: 'Số điện thoại phải gồm 10 chữ số, bắt đầu bằng 0',
      roleRequired: 'Chọn vai trò',
      depotRequired: 'Nhập kho hoặc chi nhánh',
    },
    /** Hộp thoại hiện mật khẩu tạm một lần (tạo tài khoản, đặt lại mật khẩu — D-42). */
    password: {
      createdTitle: 'Đã tạo tài khoản {name}',
      resetTitle: 'Đã đặt lại mật khẩu cho {name}',
      description: 'Mật khẩu tạm chỉ hiện một lần. Sao chép và gửi cho người dùng; họ đăng nhập bằng email {email} và mật khẩu này.',
      label: 'Mật khẩu tạm',
      copy: 'Sao chép',
      copied: 'Đã sao chép mật khẩu tạm',
      copyFailed: 'Trình duyệt không cho sao chép. Chọn chữ trong ô rồi chép tay.',
      done: 'Xong',
    },
    reset: {
      title: 'Đặt lại mật khẩu cho {name}?',
      description: 'Mật khẩu hiện tại sẽ không dùng được nữa. Hệ thống cấp một mật khẩu tạm mới và chỉ hiện một lần.',
      confirm: 'Đặt lại mật khẩu',
      cancel: 'Huỷ',
    },
    remove: {
      title: 'Xoá tài khoản {name}?',
      description: 'Tài khoản bị xoá khỏi hệ thống và không đăng nhập được nữa. Nhật ký vẫn giữ các thao tác người này đã làm.',
      confirm: 'Xoá tài khoản',
      cancel: 'Huỷ',
    },
  },
  /** Tab "Ma trận quyền" (D-41): dựng từ `ROLE_PERMISSIONS`, key trùng mã quyền (phần trước và sau dấu chấm). */
  permissions: {
    description: 'Chỉ đọc, dựng từ cấu hình quyền của hệ thống. Màn và nút của quyền không có sẽ bị ẩn.',
    permission: 'Quyền',
    granted: 'Có',
    denied: 'Không',
    labels: {
      dashboard: { view: 'Xem bảng điều khiển' },
      reports: { export: 'Xuất báo cáo .xlsx' },
      trips: { view: 'Xem chuyến hàng', edit: 'Tạo, sửa, huỷ chuyến' },
      optimization: { run: 'Chạy tối ưu' },
      plans: { view: 'Xem phương án 3D và so sánh', approve: 'Chỉnh sửa và duyệt phương án', review: 'Hàng đợi chờ duyệt: duyệt, từ chối, yêu cầu tối ưu lại' },
      fleet: { view: 'Xem đội xe', edit: 'Thêm, sửa, xoá xe và bảo dưỡng' },
      warehouse: { operate: 'Xếp hàng tại kho' },
      driver: { operate: 'Giao hàng' },
      users: { manage: 'Quản lý người dùng' },
      audit: { view: 'Xem nhật ký hệ thống' },
      packages: { register: 'Loại kiện, đăng ký kiện và in nhãn QR' },
      shipments: { manage: 'Tạo và bàn giao lô hàng' },
      receiving: { operate: 'Quét QR nhận hàng' },
      orders: { view: 'Xem đơn hàng', edit: 'Tạo, sửa đơn hàng và gán vào điểm giao' },
      vehicleTypes: { edit: 'Thêm, sửa, xoá loại xe' },
    },
  },
} as const
