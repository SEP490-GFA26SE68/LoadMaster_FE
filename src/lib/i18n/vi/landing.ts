/**
 * Trang giới thiệu công khai `/gioi-thieu` (`features/marketing`): đầu trang và chân trang dùng chung với Bảng giá, phần mở đầu, tính năng,
 * cách hoạt động và form liên hệ của khách. Chỉ nói điều ứng dụng làm được thật: không số liệu, không tên khách hàng.
 */
export const landing = {
  /** Liên kết đầu tiên của trang, chỉ hiện khi nhận focus bằng bàn phím. */
  skipToContent: 'Bỏ qua tới nội dung chính',
  header: {
    nav: 'Mục của trang giới thiệu',
    menu: 'Menu trang',
    features: 'Tính năng',
    how: 'Cách hoạt động',
    pricing: 'Bảng giá',
    contact: 'Liên hệ',
    signIn: 'Đăng nhập',
    openApp: 'Vào ứng dụng',
    home: 'LoadMaster — trang giới thiệu',
  },
  hero: {
    eyebrow: 'Lập kế hoạch chất xếp hàng 3D cho doanh nghiệp vận tải',
    title: 'Tận dụng thùng xe, dỡ đúng thứ tự, theo dõi tới điểm giao cuối.',
    lede: 'LoadMaster giúp điều phối viên lập chuyến, tối ưu tuyến và phương án xếp hàng 3D. Kho xếp và tài xế dỡ theo cùng một phương án đã duyệt.',
    cta: 'Nhận tư vấn',
    pricing: 'Xem bảng giá',
    artworkLabel: 'Mô phỏng thùng xe được xếp hàng theo thứ tự dỡ',
  },
  features: {
    title: 'Tính năng chính',
    lede: 'Một hệ thống cho cả chuyến hàng: từ lúc nhận kiện tới lúc giao xong điểm cuối.',
    loading: {
      title: 'Xếp hàng 3D theo điểm giao',
      text: 'Hàng của điểm giao cuối nằm sâu nhất, hàng của điểm đầu sát cửa: tới điểm nào lấy hàng điểm đó. Xem, xoay và chỉnh tay phương án trong không gian 3D.',
    },
    route: {
      title: 'Tối ưu tuyến và giám sát',
      text: 'Tối ưu thứ tự điểm giao, xem giờ đến dự kiến so với hạn giao, vị trí xe trên bản đồ và sự cố trên đường.',
    },
    roles: {
      title: 'Mỗi vai trò một màn phù hợp',
      text: 'Cùng một phương án đi qua bốn vai trò, mỗi người làm việc trên thiết bị của mình.',
    },
    /** Việc của từng vai trò; tên vai trò lấy từ nhánh `roles`. */
    roleList: {
      dispatcher: 'Lập chuyến, chạy tối ưu, so sánh và duyệt phương án.',
      warehouse: 'Soạn và xếp từng kiện trên máy tính bảng, đối chiếu bằng mã QR.',
      driver: 'Giao theo từng điểm trên điện thoại, xem vị trí hàng trong thùng.',
      companyManager: 'Lập yêu cầu giao, theo dõi bảng điều khiển và xuất báo cáo.',
    },
  },
  how: {
    title: 'Cách hoạt động',
    lede: 'Bốn bước của một chuyến hàng trên LoadMaster.',
    step: 'Bước {number}',
    steps: {
      intake: {
        title: 'Nhập kiện và yêu cầu giao',
        text: 'Nhập kiện từ file hoặc thêm tay, in nhãn QR. Quản lý lập yêu cầu giao với điểm đến và hạn giao.',
      },
      plan: {
        title: 'Lập chuyến, tối ưu tuyến',
        text: 'Điều phối viên đưa yêu cầu vào chuyến, chọn xe và tối ưu thứ tự điểm giao.',
      },
      optimize: {
        title: 'Xếp 3D, so sánh, duyệt',
        text: 'Một lần chạy cho ba phương án theo ba mục tiêu. So sánh, chỉnh tay nếu cần rồi duyệt.',
      },
      operate: {
        title: 'Soạn, xếp, giao, giám sát',
        text: 'Kho đối chiếu từng kiện khi soạn và xếp, tài xế giao theo điểm, điều phối viên giám sát xe và xử lý sự cố.',
      },
    },
  },
  contact: {
    title: 'Liên hệ với LoadMaster',
    lede: 'Để lại thông tin, đội LoadMaster sẽ liên hệ lại để tư vấn gói và cách dùng phù hợp với đội xe của bạn.',
    signUpNote: 'Tài khoản công ty do đội LoadMaster tạo sau khi trao đổi với bạn.',
    loading: 'Đang tải form liên hệ',
    form: {
      fullName: 'Họ tên',
      email: 'Email',
      emailPlaceholder: 'ten@congty.vn',
      phone: 'Số điện thoại',
      company: 'Tên công ty',
      type: 'Bạn cần gì',
      plan: 'Gói quan tâm',
      noPlan: 'Chưa chọn gói',
      message: 'Nội dung',
      messagePlaceholder: 'Số xe, tuyến hay chạy, điều bạn muốn biết thêm.',
      submit: 'Gửi yêu cầu',
      errors: {
        fullNameRequired: 'Nhập họ tên',
        fullNameTooLong: 'Họ tên tối đa {max} ký tự',
        emailRequired: 'Nhập email',
        emailInvalid: 'Email không đúng định dạng',
        emailTooLong: 'Email tối đa {max} ký tự',
        phoneTooLong: 'Số điện thoại tối đa {max} ký tự',
        companyTooLong: 'Tên công ty tối đa {max} ký tự',
        messageTooLong: 'Nội dung tối đa {max} ký tự',
      },
    },
    sent: {
      title: 'Đã ghi nhận yêu cầu {id}',
      text: 'Đội LoadMaster sẽ liên hệ lại qua email bạn đã nhập.',
      again: 'Gửi yêu cầu khác',
    },
  },
  footer: {
    nav: 'Liên kết cuối trang',
    landing: 'Giới thiệu',
    pricing: 'Bảng giá',
    contact: 'Liên hệ',
    signIn: 'Đăng nhập',
  },
} as const
