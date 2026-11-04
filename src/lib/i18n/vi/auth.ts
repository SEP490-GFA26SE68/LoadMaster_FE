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
    roleUnknown: 'Tài khoản mang vai trò mà ứng dụng chưa hỗ trợ. Liên hệ quản trị viên của bạn.',
    // Bốn câu sau chỉ có khi đăng nhập bằng máy chủ (`VITE_AUTH_SOURCE=keycloak`)
    /** Mật khẩu đúng nhưng là mật khẩu tạm (tài khoản mới, hoặc quản trị viên vừa đặt lại). */
    passwordChangeRequired: 'Tài khoản đang dùng mật khẩu tạm. Đặt mật khẩu mới trước khi đăng nhập.',
    setNewPassword: 'Đặt mật khẩu mới',
    /** Client của realm Keycloak chưa bật đăng nhập bằng mật khẩu — lỗi cấu hình máy chủ. */
    loginNotEnabled: 'Máy chủ chưa bật đăng nhập trong ứng dụng. Báo quản trị viên hệ thống.',
    /** Keycloak nhận tài khoản nhưng máy chủ không có người dùng nào gắn với nó. */
    accountNotLinked: 'Tài khoản đăng nhập được nhưng chưa gắn với người dùng nào trên máy chủ. Liên hệ quản trị viên của bạn.',
    /** Máy chủ không nhận token: máy chủ và app không dùng cùng một Keycloak. */
    sessionRejected: 'Máy chủ không chấp nhận phiên đăng nhập này. Báo quản trị viên hệ thống.',
    forgotPassword: 'Quên mật khẩu?',
    /** Liên kết về trang giới thiệu công khai `/gioi-thieu`. */
    backToLanding: 'Về trang giới thiệu',
    /** Chế độ đăng nhập bằng máy chủ (`VITE_AUTH_SOURCE=keycloak`). */
    sso: {
      sampleData: 'Tài khoản lấy từ máy chủ. Chuyến, xe và kiện hàng trên màn vẫn là dữ liệu mẫu.',
    },
  },
  /** Đặt mật khẩu mới bằng mã gửi qua email `/quen-mat-khau` (chỉ khi đăng nhập bằng máy chủ). */
  reset: {
    title: 'Đặt mật khẩu mới',
    backToLogin: 'Về đăng nhập',
    backToProfile: 'Về hồ sơ',
    email: {
      title: 'Nhập email của bạn',
      intro: 'Chúng tôi gửi một mã gồm 6 chữ số tới email của tài khoản để xác nhận đó là bạn.',
      submit: 'Gửi mã',
    },
    code: {
      title: 'Nhập mã xác nhận',
      sent: 'Nếu {email} có trong hệ thống, mã gồm 6 chữ số đã được gửi tới hộp thư này. Mã dùng được trong 3 phút.',
      label: 'Mã xác nhận',
      required: 'Nhập đủ 6 chữ số của mã',
      submit: 'Xác nhận mã',
      resend: 'Gửi lại mã',
      resent: 'Đã gửi mã mới.',
      changeEmail: 'Đổi email',
    },
    password: {
      title: 'Đặt mật khẩu mới',
      intro: 'Mật khẩu mới cho {email}, ít nhất {min} ký tự.',
      label: 'Mật khẩu mới',
      confirm: 'Nhập lại mật khẩu mới',
      tooShort: 'Mật khẩu cần ít nhất 8 ký tự',
      mismatch: 'Hai mật khẩu chưa khớp',
      submit: 'Lưu mật khẩu mới',
    },
    done: {
      title: 'Đã đặt mật khẩu mới',
      body: 'Đăng nhập bằng mật khẩu vừa đặt.',
      bodySignedIn: 'Lần đăng nhập sau dùng mật khẩu vừa đặt.',
    },
    /** Máy chủ từ chối mỗi bước bằng cùng một lỗi không mã: câu nói lý do theo bước. */
    errors: {
      tooManyRequests: 'Bạn vừa yêu cầu mã. Chờ một phút rồi thử lại; mỗi 15 phút gửi được tối đa 3 lần.',
      codeInvalid: 'Mã không đúng hoặc đã hết hạn. Kiểm tra lại, hoặc gửi mã mới.',
      cooldown: 'Mã vừa được gửi. Chờ một phút rồi gửi lại.',
      requestLimit: 'Bạn đã yêu cầu mã 3 lần trong 15 phút. Thử lại sau.',
      codeExpired: 'Mã đã hết hạn (mỗi mã dùng được 3 phút). Gửi mã mới.',
      codeIncorrect: 'Mã không đúng. Kiểm tra lại email rồi nhập lại.',
      attemptsExceeded: 'Bạn đã nhập sai 5 lần nên mã bị huỷ. Gửi mã mới.',
      expired: 'Phiên đặt mật khẩu đã hết hạn. Gửi mã mới để làm lại.',
      failed: 'Không kết nối được máy chủ. Thử lại sau.',
    },
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
