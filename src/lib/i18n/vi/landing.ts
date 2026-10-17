/**
 * Trang giới thiệu công khai `/gioi-thieu` (`features/marketing`): đầu trang và chân trang dùng chung với Bảng giá, phần mở đầu và khung
 * 3D, dải số liệu, tính năng, cách hoạt động, gói cước và form liên hệ của khách. Chỉ nói điều ứng dụng làm được thật: không tên hay lời
 * khen của khách hàng; số nào cũng có nguồn — lần chạy của bộ tối ưu mô phỏng trên trình duyệt (kèm MOCK RESULT), hằng số trong code,
 * hoặc danh mục gói.
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
    /** Bốn vai trò làm việc trên cùng một phương án; tên vai trò lấy từ nhánh `roles`. */
    roles: 'Một phương án cho cả bốn vai trò',
  },
  /**
   * Khung 3D của phần mở đầu: chuyến mẫu do bộ tối ưu mô phỏng tính ngay trên trình duyệt của người xem, vẽ bằng bộ máy 3D của ứng dụng.
   * Mọi số ở đây là số của lần chạy đó và đi kèm MOCK RESULT.
   */
  stage: {
    title: 'Thùng mẫu 6 m',
    caption: 'Chuyến mẫu {count} kiện cho {stops} điểm giao, do bộ tối ưu mô phỏng tính ngay trên trình duyệt của bạn rồi xếp từng kiện theo thứ tự. Hàng của điểm giao cuối nằm sâu nhất, hàng của điểm đầu sát cửa.',
    /** Câu dưới hình minh hoạ khi trình duyệt không vẽ được khung 3D: không nói gì về lần chạy, vì không có lần chạy nào. */
    artworkCaption: 'Hình minh hoạ: hàng của điểm giao cuối nằm sâu nhất, hàng của điểm đầu sát cửa — tới điểm nào lấy hàng điểm đó.',
    preparing: 'Đang tính phương án mẫu…',
    views: 'Góc nhìn',
    view: {
      overview: 'Toàn cảnh',
      zones: 'Vùng điểm giao',
      door: 'Cửa sau',
    },
    replay: 'Xếp lại',
    replayLabel: 'Xếp lại thùng xe từ đầu',
    legend: 'Màu của kiện theo điểm giao',
    stop: 'Điểm {number}',
    readout: {
      title: 'Kết quả của lần chạy',
      placed: 'Kiện đã xếp',
      placedValue: '{placed} / {total}',
      volume: 'Lấp đầy thể tích',
      payload: 'Tải trọng',
      rehandling: 'Phải dỡ-xếp lại',
      runtime: 'Thời gian tính',
      runtimeValue: '{ms} ms',
    },
  },
  /** Tên bốn điểm giao của chuyến mẫu — khung 3D ghi tên này trên dải vùng; bản tiếng Anh không có chữ có dấu. */
  sample: {
    stop1: 'Siêu thị',
    stop2: 'Cửa hàng tiện lợi',
    stop3: 'Nhà phân phối',
    stop4: 'Đại lý tạp hoá',
  },
  /**
   * Dải số liệu dưới phần mở đầu (`#con-so`): mỗi số lấy từ hằng số trong code của ứng dụng (số hướng đặt, số phương án, số luật nhận
   * hàng, số vai trò, bước làm tròn) hoặc từ ngưỡng kiểm hiệu năng của bộ tối ưu mô phỏng — câu nguồn nói rõ số đến từ đâu.
   */
  facts: {
    title: 'Con số kiểm được',
    lede: 'Mỗi con số dưới đây lấy thẳng từ mã nguồn của ứng dụng hoặc từ phép đo của nó — không con số nào là ước đoán.',
    orientations: {
      label: 'hướng đặt được thử cho mỗi kiện',
      source: 'Kiện phải giữ đứng chỉ dùng hai hướng; hướng nào không lọt cửa xe thì bị loại.',
    },
    plans: {
      label: 'phương án cho mỗi lần chạy tối ưu',
      source: 'Tối đa thể tích, cân bằng tải trục, ít dỡ-xếp lại — so sánh cạnh nhau rồi duyệt một.',
    },
    precision: {
      label: 'bước làm tròn kích thước',
      source: 'Khối lượng làm tròn tới {kg}; hai kiện chạm mặt không bị báo chồng lấn vì sai số làm tròn.',
    },
    speed: {
      value: '< {seconds} giây',
      label: 'để xếp {count} kiện, đủ ba phương án',
      source: 'Ngưỡng kiểm hiệu năng của bộ tối ưu mô phỏng, đo trên máy phát triển.',
    },
    pickup: {
      label: 'luật kiểm trước khi nhận hàng dọc đường',
      source: 'Tải trọng, tải trục, trọng tâm, chỗ trống trong thùng, thứ tự dỡ, hạn giao…',
    },
    roles: {
      label: 'vai trò, mỗi vai trò chỉ thấy việc của mình',
      source: 'Ba vai trò của nền tảng, năm vai trò của công ty vận tải.',
    },
  },
  features: {
    title: 'Tính năng chính',
    lede: 'Một hệ thống cho cả chuyến hàng: từ lúc nhận kiện tới lúc giao xong điểm cuối.',
    loading: {
      title: 'Xếp hàng 3D theo điểm giao',
      text: 'Hàng của điểm giao cuối nằm sâu nhất, hàng của điểm đầu sát cửa: tới điểm nào lấy hàng điểm đó. Xem, xoay và chỉnh tay phương án trong không gian 3D.',
    },
    /** Sơ đồ thùng xe chia vùng của thẻ "Xếp hàng 3D theo điểm giao" — chữ trong hình. */
    zones: {
      door: 'Cửa sau',
      zone: 'Vùng {number}',
    },
    plans: {
      title: 'Ba phương án, một lần chạy',
      text: 'Mỗi lần chạy cho ba phương án theo ba mục tiêu. So sánh cạnh nhau, chỉnh tay nếu cần rồi duyệt một.',
    },
    route: {
      title: 'Tối ưu tuyến và giám sát',
      text: 'Tối ưu thứ tự điểm giao, xem giờ đến dự kiến so với hạn giao, vị trí xe trên bản đồ và sự cố trên đường.',
      /** Kho xuất phát trên sơ đồ tuyến của thẻ. */
      depot: 'Kho',
    },
    verify: {
      title: 'Đối chiếu kiện ba mức',
      text: 'Mỗi kiện được đối chiếu khi soạn, xếp và dỡ. Nhãn rách hay mất mã vẫn làm tiếp được, chờ điều phối viên duyệt.',
      levels: {
        qr: 'Quét mã QR',
        code: 'Gõ mã kiện',
        manual: 'Xác nhận tay',
      },
    },
    pickup: {
      title: 'Nhận hàng dọc đường',
      text: 'Xe đang chạy vẫn nhận thêm hàng: mười luật kiểm trước khi duyệt, kiện mới được xếp vào chỗ trống mà không dời kiện nào đang chở.',
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
      manager: 'Lập yêu cầu giao, theo dõi bảng điều khiển và xuất báo cáo.',
    },
  },
  how: {
    title: 'Cách hoạt động',
    lede: 'Bốn bước của một chuyến hàng trên LoadMaster.',
    step: 'Bước {number}',
    /** Ai làm bước đó; tên vai trò lấy từ nhánh `roles`. */
    who: 'Người làm',
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
  /** Phần gói cước của trang giới thiệu (`#goi-cuoc`): tóm tắt danh mục gói đang bán; chi tiết ở Bảng giá. */
  plans: {
    title: 'Gói cước',
    lede: 'Chọn theo số lần chạy tối ưu 3D mỗi tháng. Tối ưu tuyến không tốn credit.',
    credit: 'Một lần chạy tối ưu 3D dùng 1 credit và cho ra cả ba phương án.',
    credits: '{count} credit mỗi tháng',
    compare: 'So sánh các gói',
    loading: 'Đang tải danh sách gói',
    error: 'Chưa tải được danh sách gói. Bảng giá có đủ thông tin của từng gói.',
  },
  contact: {
    title: 'Liên hệ với LoadMaster',
    lede: 'Để lại thông tin, đội LoadMaster sẽ liên hệ lại để tư vấn gói và cách dùng phù hợp với đội xe của bạn.',
    signUpNote: 'Tài khoản công ty do đội LoadMaster tạo sau khi trao đổi với bạn.',
    loading: 'Đang tải form liên hệ',
    /** Việc xảy ra sau khi khách gửi yêu cầu; bước cuối là `signUpNote`. */
    next: {
      title: 'Sau khi bạn gửi',
      reply: 'Đội LoadMaster đọc yêu cầu và trả lời qua email bạn để lại.',
      talk: 'Hai bên trao đổi về đội xe, tuyến hay chạy và gói phù hợp.',
    },
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
    /** Tiêu đề hai cột liên kết — là `<p>`, không phải tiêu đề mục (Bảng giá chỉ có tên gói làm tiêu đề cấp 2). */
    product: 'Sản phẩm',
    account: 'Tài khoản',
    landing: 'Giới thiệu',
    pricing: 'Bảng giá',
    contact: 'Liên hệ',
    signIn: 'Đăng nhập',
    note: 'Đây là bản demo: dữ liệu trong ứng dụng là dữ liệu mẫu, kết quả tối ưu do bộ tối ưu mô phỏng tính và luôn mang nhãn MOCK RESULT.',
  },
} as const
