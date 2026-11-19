/**
 * Trang giới thiệu công khai `/gioi-thieu` (`features/marketing`): đầu trang dùng chung với Bảng giá, phần mở đầu và khung 3D, dải số
 * liệu, tính năng, cách hoạt động, gói cước và form liên hệ của khách; chân trang ở nhánh `landingFooter`. Chỉ nói điều ứng dụng làm
 * được thật: không tên hay lời khen của khách hàng; số nào cũng có câu nguồn — lần chạy của bộ tối ưu mô phỏng trên trình duyệt, hằng số
 * trong code, hoặc danh mục gói. Trang công khai không hiện nhãn MOCK RESULT: câu nguồn nói thay.
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
    trial: 'Đăng ký trải nghiệm',
    registerNow: 'Đăng ký dùng ngay',
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
   * Mọi số ở đây là số của lần chạy đó; câu `caption` nói số do bộ tối ưu mô phỏng tính (không nhãn MOCK RESULT trên trang công khai).
   */
  stage: {
    title: 'Thùng 6 m',
    /**
     * Thẻ chuyến trong khung: số kiện và số điểm giao của yêu cầu mẫu (cố định); chip "Đã tính phương án" đứng trước pha xếp — chip này chỉ
     * có ở trang giới thiệu, không phải trạng thái chuyến của ứng dụng.
     */
    trip: 'Chuyến mẫu',
    load: '{count} kiện · {stops} điểm giao',
    computed: 'Đã tính phương án',
    /** Hàng "Thứ tự giao" dưới khung: kho rồi các điểm giao theo thứ tự đi. */
    route: 'Thứ tự giao',
    depot: 'Kho',
    caption: 'Chuyến mẫu {count} kiện cho {stops} điểm giao, do bộ tối ưu mô phỏng tính ngay trên trình duyệt của bạn rồi xếp từng kiện theo thứ tự. Hàng của điểm giao cuối nằm sâu nhất, hàng của điểm đầu sát cửa.',
    /** Câu dưới hình minh hoạ khi trình duyệt không vẽ được khung 3D: không nói gì về lần chạy, vì không có lần chạy nào. */
    artworkCaption: 'Hình minh hoạ: hàng của điểm giao cuối nằm sâu nhất, hàng của điểm đầu sát cửa — tới điểm nào lấy hàng điểm đó.',
    preparing: 'Đang tính phương án mẫu…',
    views: 'Góc nhìn',
    view: {
      overview: 'Toàn cảnh',
      truck: 'Thùng xe',
      zones: 'Vùng điểm giao',
    },
    replay: 'Xếp lại',
    replayLabel: 'Xếp lại thùng xe từ đầu',
    /** Nút ba trạng thái của chuyện trong khung (Tạm dừng · Tiếp tục · Xếp lại): chữ hiện ra là phần đầu của tên truy cập (WCAG 2.5.3). */
    story: {
      pause: 'Tạm dừng',
      pauseLabel: 'Tạm dừng chuyến mẫu',
      resume: 'Tiếp tục',
      resumeLabel: 'Tiếp tục chuyến mẫu',
    },
    legend: 'Màu của kiện theo điểm giao',
    stop: 'Điểm {number}',
    readout: {
      title: 'Kết quả của phương án mẫu',
      /** Câu giữ chỗ trước khi xếp xong, cùng chiều cao với dải số: số của phương án mẫu chỉ hiện khi đã có. */
      pending: 'Số liệu của phương án mẫu hiện ra khi xếp xong.',
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
   * Dải số liệu dưới phần mở đầu (`#con-so`): sáu con số người mua quan tâm, mỗi số lấy từ hằng số trong code của ứng dụng (số phương án,
   * credit mỗi lần chạy, số luật nhận hàng, số cách đối chiếu, số vai trò trong công ty) hoặc từ ngưỡng của bài đo hiệu năng của bộ tối ưu
   * mô phỏng — câu nguồn nói rõ số đến từ đâu. Giá trị có chữ (`credit.value`, `speed.value`) nhận số qua tham số.
   */
  facts: {
    title: 'Con số kiểm được',
    lede: 'Mỗi con số đi kèm nguồn của nó: hằng số trong ứng dụng hoặc ngưỡng của một bài đo tự động — không con số nào là ước đoán.',
    plans: {
      label: 'phương án cho mỗi lần chạy tối ưu',
      source: 'Tối đa thể tích, cân bằng tải trục, ít dỡ-xếp lại — so cạnh nhau rồi duyệt một.',
    },
    credit: {
      value: { one: '{count} credit', other: '{count} credit' },
      label: 'cho một lần chạy tối ưu 3D',
      source: 'Cả ba phương án vẫn tính là một lần chạy; tối ưu thứ tự điểm giao không tốn credit.',
    },
    speed: {
      value: '< {seconds} giây',
      label: 'để xếp {count} kiện thành đủ ba phương án',
      source: 'Ngưỡng của bài đo hiệu năng tự động cho bộ tối ưu mô phỏng, đo trên máy phát triển — máy khác có thể khác.',
    },
    pickup: {
      label: 'luật kiểm trước khi nhận hàng dọc đường',
      source: 'Tải trọng, tải trục, trọng tâm, chỗ trống trong thùng, thứ tự dỡ, hạn giao…',
    },
    verify: {
      label: 'cách đối chiếu một kiện',
      source: 'Quét mã QR, gõ mã in trên nhãn, hoặc xác nhận tay chờ điều phối viên duyệt khi nhãn hỏng.',
    },
    roles: {
      label: 'vai trò trong công ty của bạn',
      /** `{roles}`: tên năm vai trò của công ty, nối bằng `format.list`. */
      source: '{roles} — mỗi người chỉ thấy việc của mình.',
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
      companyManager: 'Theo dõi bảng điều khiển, giám sát chuyến đang chạy và xuất báo cáo.',
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
        text: 'Kho nhập kiện từ file hoặc thêm tay, in nhãn QR. Điều phối viên lập yêu cầu giao với điểm đến và hạn giao.',
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
    credit: { one: 'Một lần chạy tối ưu 3D dùng {count} credit và cho ra cả ba phương án.', other: 'Một lần chạy tối ưu 3D dùng {count} credit và cho ra cả ba phương án.' },
    credits: '{count} credit mỗi tháng',
    compare: 'So sánh các gói',
    loading: 'Đang tải danh sách gói',
    error: 'Chưa tải được danh sách gói. Bảng giá có đủ thông tin của từng gói.',
  },
  contact: {
    title: 'Liên hệ với LoadMaster',
    lede: 'Để lại thông tin, đội LoadMaster sẽ liên hệ lại để tư vấn gói và cách dùng phù hợp với đội xe của bạn.',
    signUpNote: 'Tài khoản công ty do đội LoadMaster tạo sau khi trao đổi với bạn.',
    /** Thay `signUpNote` khi khách tự đăng ký được (nhóm `registration` nối máy chủ). */
    signUpNoteSelf: 'Khi sẵn sàng, bạn tự đăng ký tài khoản công ty: đăng ký trải nghiệm để dùng thử, hoặc đăng ký dùng ngay rồi chọn gói và thanh toán.',
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
} as const
