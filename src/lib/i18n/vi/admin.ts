/**
 * Quản trị người dùng (LM-071, LM-092): danh sách có tìm/lọc, menu thao tác mỗi dòng, hộp thoại thêm/sửa, mật khẩu tạm, xác nhận
 * xoá, và tab "Ma trận quyền" chỉ đọc. Tên vai trò ở nhánh `roles`. FE-0-08: quản trị hệ thống thấy mọi tài khoản (cột và bộ lọc
 * công ty), quản trị công ty chỉ thấy người của công ty mình.
 */
export const admin = {
  users: {
    title: 'Người dùng',
    count: { one: '{count} tài khoản', other: '{count} tài khoản' },
    /** Dòng số đếm dưới tiêu đề màn: đếm trên danh sách kho trả cho người xem, ghép các phần bằng dấu chấm giữa. */
    heroCount: {
      roles: { one: '{count} vai trò', other: '{count} vai trò' },
      depots: { one: '{count} kho / chi nhánh', other: '{count} kho / chi nhánh' },
      companies: { one: '{count} công ty', other: '{count} công ty' },
    },
    neverSignedIn: 'Chưa đăng nhập',
    /** Người dùng nền tảng không thuộc kho nào (FE-0-03): chữ thay cho ô kho ở bảng và panel chi tiết. */
    noDepot: 'Không thuộc kho nào',
    /** Tài khoản nền tảng không thuộc công ty nào: chữ thay cho tên công ty ở bảng, panel chi tiết và lựa chọn của bộ lọc công ty. */
    platformAccount: 'Nền tảng',
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
    filters: {
      role: 'Vai trò', allRoles: 'Mọi vai trò', status: 'Trạng thái', allStatuses: 'Mọi trạng thái',
      /** Chỉ quản trị hệ thống có bộ lọc này. */
      company: 'Công ty', allCompanies: 'Mọi công ty',
    },
    updated: 'Đã cập nhật {name}',
    locked: 'Đã khoá tài khoản {name}',
    unlocked: 'Đã mở khoá tài khoản {name}',
    deleted: 'Đã xoá tài khoản {name}',
    columns: {
      user: 'Người dùng',
      phone: 'Điện thoại',
      role: 'Vai trò',
      company: 'Công ty',
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
      systemAdmin: 'Máy tính',
      systemManager: 'Máy tính',
      systemSupporter: 'Máy tính',
      companyAdmin: 'Máy tính',
      companyManager: 'Máy tính / máy tính bảng',
      dispatcher: 'Máy tính',
      warehouse: 'Máy tính bảng tại kho',
      driver: 'Điện thoại',
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
    /** Lý do một thao tác bị chặn trước khi gửi kho (`account-guards.ts`), hiện ngay dưới thao tác bị làm mờ. */
    blocked: {
      self: 'Không áp dụng cho tài khoản bạn đang đăng nhập',
      lastSystemAdmin: 'Nền tảng cần ít nhất một quản trị hệ thống đang hoạt động',
      lastCompanyAdmin: 'Công ty cần ít nhất một quản trị công ty đang hoạt động',
      companyManaged: 'Nhân sự công ty do quản trị công ty đó quản lý',
    },
    form: {
      createTitle: 'Thêm người dùng',
      editTitle: 'Sửa người dùng',
      createDescription: 'Hệ thống cấp mật khẩu tạm và chỉ hiện một lần sau khi tạo.',
      /** Quản trị hệ thống tạo tài khoản nền tảng; quản trị công ty tạo người cho công ty mình (FE-0-08). */
      createDescriptionPlatform: 'Tài khoản nền tảng, không thuộc công ty nào. Hệ thống cấp mật khẩu tạm và chỉ hiện một lần sau khi tạo.',
      editDescription: 'Sửa thông tin liên hệ, kho và vai trò của tài khoản.',
      editDescriptionPlatform: 'Sửa thông tin liên hệ và vai trò của tài khoản nền tảng.',
      fullName: 'Họ và tên',
      fullNamePlaceholder: 'Nguyễn Thanh Tùng',
      phone: 'Số điện thoại',
      email: 'Email',
      emailPlaceholder: 'ten@loadmaster.vn',
      depot: 'Kho / chi nhánh',
      depotPlaceholder: 'Kho Long Bình',
      role: 'Vai trò',
      company: 'Công ty',
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
      companyRequired: 'Vui lòng chọn công ty'
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
  /**
   * Tab "Ma trận quyền" (D-41): dựng từ `ROLE_PERMISSIONS`, key trùng mã quyền (phần trước và sau dấu chấm). Tám vai trò của PRD v2
   * cùng 19 quyền mới (FE-0-01): phần lớn thuộc màn các sprint sau mới làm, nên câu mô tả nói rõ điều đó.
   */
  permissions: {
    description: 'Chỉ đọc, dựng từ cấu hình quyền của hệ thống. Màn và nút của quyền không có sẽ bị ẩn. Một số quyền thuộc những màn bản này chưa có.',
    permission: 'Quyền',
    granted: 'Có',
    denied: 'Không',
    /** Đầu thẻ ma trận: tiêu đề, kích thước (đếm từ danh sách quyền và vai trò), chú giải hai loại ô. */
    title: 'Ma trận quyền',
    size: '{permissions} quyền × {roles} vai trò',
    /** Dưới tên vai trò ở đầu cột: số tài khoản người xem đang liệt kê được. */
    accountCount: { one: '{count} tài khoản', other: '{count} tài khoản' },
    /** Dòng cuối: số quyền của từng vai trò trên tổng số quyền. */
    total: 'Số quyền của vai trò',
    totalOf: '{count} trong {total} quyền',
    /** Nhóm quyền theo khu vực (`permission-groups.ts`): key trùng mã nhóm. */
    groups: {
      administration: 'Công ty, người dùng và nhật ký',
      billing: 'Gói cước và credit',
      support: 'Hỗ trợ khách hàng',
      dashboard: 'Bảng điều khiển và báo cáo',
      requirements: 'Yêu cầu giao',
      packages: 'Kho kiện và nhãn QR',
      trips: 'Chuyến hàng và phương án',
      monitoring: 'Giám sát',
      fleet: 'Đội xe',
      exceptions: 'Sự cố và gia hạn giao',
      pickups: 'Nhận hàng dọc đường',
      warehouse: 'Kho',
      driver: 'Tài xế',
    },
    labels: {
      companies: { manage: 'Tạo và quản lý công ty khách hàng' },
      users: { manage: 'Quản lý người dùng' },
      audit: { view: 'Xem nhật ký hệ thống' },
      subscriptionPlans: { manage: 'Tạo, sửa gói cước và chính sách credit' },
      billing: { manage: 'Mua gói cước, nạp credit, xem giao dịch' },
      support: { create: 'Gửi yêu cầu hỗ trợ', handle: 'Xử lý yêu cầu hỗ trợ' },
      dashboard: { view: 'Xem bảng điều khiển' },
      reports: { export: 'Xuất báo cáo .xlsx' },
      requirements: { view: 'Xem yêu cầu giao', edit: 'Tạo, sửa yêu cầu giao' },
      packages: {
        view: 'Xem kho kiện',
        manage: 'Nhập file, thêm kiện, loại kiện, gỡ cờ kiện',
        lookup: 'Tra cứu kiện bằng mã QR',
      },
      labels: { print: 'In nhãn QR' },
      trips: { view: 'Xem chuyến hàng', edit: 'Tạo, sửa, huỷ chuyến' },
      routes: { optimize: 'Tối ưu tuyến' },
      optimization: { run: 'Chạy tối ưu' },
      plans: { view: 'Xem phương án 3D và so sánh', approve: 'Chỉnh sửa và duyệt phương án' },
      manualConfirm: { approve: 'Duyệt kiện xác nhận tay' },
      monitoring: { view: 'Xem giám sát chuyến đang chạy' },
      fleet: { view: 'Xem đội xe', edit: 'Thêm, sửa, xoá xe và bảo dưỡng' },
      vehicleTypes: { edit: 'Thêm, sửa, xoá loại xe' },
      exceptions: { report: 'Báo sự cố chuyến', resolve: 'Xử lý sự cố chuyến' },
      deadlines: { renegotiate: 'Gia hạn giao hàng' },
      pickups: { create: 'Tạo yêu cầu nhận hàng dọc đường', approve: 'Duyệt yêu cầu nhận hàng dọc đường' },
      warehouse: { operate: 'Xếp hàng tại kho' },
      driver: { operate: 'Giao hàng' },
    },
  },
} as const
