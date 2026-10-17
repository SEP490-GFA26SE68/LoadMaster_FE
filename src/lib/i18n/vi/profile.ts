/** Màn Hồ sơ cá nhân `/ho-so` (LM-096, D-42): sửa họ tên, số điện thoại của chính mình và đổi mật khẩu. */
export const profile = {
  title: 'Hồ sơ cá nhân',
  /** Cột nhận diện (V2): tên, vai trò và những thông tin chỉ quản trị viên đổi được. */
  identity: {
    label: 'Tài khoản',
    email: 'Email',
    depot: 'Kho trực thuộc',
    note: 'Email, vai trò và kho trực thuộc do quản trị viên thay đổi.',
    phone: 'Số điện thoại',
    // Đăng nhập bằng Keycloak: thông tin là của tài khoản trên máy chủ, backend chưa có lối tự sửa
    serverNote: 'Họ tên, email và số điện thoại là của tài khoản trên máy chủ. Quản trị viên sửa họ tên và số điện thoại ở màn Người dùng.',
  },
  /** Đăng nhập bằng Keycloak: mật khẩu đổi ở trang tài khoản của Keycloak, app không thu mật khẩu. */
  account: {
    title: 'Mật khẩu',
    description: 'Mật khẩu đăng nhập do Keycloak quản lý. Đổi mật khẩu ở trang tài khoản, mở trong thẻ mới.',
    changePassword: 'Đổi mật khẩu',
    newTab: '(mở trong thẻ mới)',
  },
  details: {
    title: 'Thông tin cá nhân',
    description: 'Họ tên và số điện thoại bạn tự sửa được.',
    fullName: 'Họ và tên',
    phone: 'Số điện thoại',
    save: 'Lưu thay đổi',
    saved: 'Đã lưu hồ sơ',
  },
  password: {
    title: 'Đổi mật khẩu',
    description: 'Từ lần đăng nhập sau, dùng mật khẩu mới.',
    current: 'Mật khẩu hiện tại',
    next: 'Mật khẩu mới',
    nextHint: 'Ít nhất {min} ký tự',
    confirm: 'Nhập lại mật khẩu mới',
    submit: 'Đổi mật khẩu',
    changed: 'Đã đổi mật khẩu',
  },
  /** Lỗi của hai form; schema giữ key, form dịch lúc hiển thị. */
  errors: {
    fullNameRequired: 'Nhập họ tên',
    fullNameTooLong: 'Họ tên tối đa 80 ký tự',
    phoneRequired: 'Nhập số điện thoại',
    phoneInvalid: 'Số điện thoại phải gồm 10 chữ số, bắt đầu bằng 0',
    currentRequired: 'Nhập mật khẩu hiện tại',
    currentIncorrect: 'Mật khẩu hiện tại không đúng',
    nextTooShort: 'Mật khẩu mới cần ít nhất {min} ký tự',
    confirmMismatch: 'Mật khẩu nhập lại không khớp',
  },
} as const
