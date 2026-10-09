/** Màn đăng nhập, tài khoản demo và nút thoát theo vai trò. */
export const auth = {
  login: {
    title: 'Đăng nhập',
    /** Lời chào của linh vật (LM-105); "Lumo" là tên riêng, không dịch. */
    greeting: 'Xin chào, mình là Lumo!',
    subtitle: 'Hệ thống lập kế hoạch và tối ưu chất xếp hàng hoá 3D.',
    email: 'Email',
    emailPlaceholder: 'ten@loadmaster.vn',
    password: 'Mật khẩu',
    submit: 'Đăng nhập',
    emailRequired: 'Nhập email',
    emailInvalid: 'Email không đúng định dạng',
    passwordRequired: 'Nhập mật khẩu',
    invalidCredentials: 'Email hoặc mật khẩu không đúng',
    /** Một câu cho cả hai loại tài khoản (FE-0-08): nhân sự công ty do quản trị công ty mở khoá, tài khoản nền tảng do quản trị hệ thống. */
    accountSuspended: 'Tài khoản đã bị khoá. Liên hệ quản trị viên của bạn để mở khoá.',
    serverUnreachable: 'Không kết nối được máy chủ. Thử lại sau.',
  },
  showcase: {
    tagline: 'Mỗi chuyến xe chở được nhiều hơn, và dỡ hàng đúng thứ tự.',
    fillRate: 'Tăng tỷ lệ lấp đầy xe, giảm số chuyến phải chạy',
    reverseOrder: 'Xếp ngược thứ tự giao — tới điểm nào lấy hàng điểm đó',
    // Không quảng cáo tải trục: số tải trục là ước lượng của mock (MOCK RESULT), chưa phải tính năng để giới thiệu (AGENTS mục 6)
    sharedPlan: 'Kho xếp và tài xế dỡ theo cùng một phương án 3D đã duyệt',
    artworkLabel: 'Mô phỏng thùng xe được xếp hàng theo thứ tự dỡ',
  },
  /** Nút hiện / ẩn mật khẩu trong ô nhập (`PasswordInput`): tên nút nói việc sẽ xảy ra khi bấm. */
  passwordToggle: {
    show: 'Hiện mật khẩu',
    hide: 'Ẩn mật khẩu',
  },
  demo: {
    title: 'Tài khoản dùng thử',
    password: 'mật khẩu {password}',
    /** Nhóm tài khoản không thuộc công ty nào; các nhóm còn lại mang tên công ty trong dữ liệu (FE-0-03). */
    platform: 'Nền tảng',
  },
} as const
