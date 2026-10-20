/**
 * Trang giới thiệu công khai `/gioi-thieu` (`features/marketing`): phần mở đầu và khung 3D, dải số liệu, tính năng, cách hoạt động, gói
 * cước và form liên hệ của khách (đầu trang ở `landingChrome`, chân trang ở `landingFooter`). Chỉ nói điều ứng dụng làm được thật: không tên hay lời
 * khen của khách hàng; số nào cũng có nguồn — lần chạy của bộ tối ưu mô phỏng trên trình duyệt (kèm MOCK RESULT), hằng số trong code,
 * hoặc danh mục gói. Nguyên tắc "vùng của điểm cuối sâu nhất, vùng của điểm đầu sát cửa" giải thích đầy đủ **một lần**, ở ô xếp hàng của
 * Tính năng chính (`features.loading.text`, cạnh sơ đồ vùng); chỗ khác chỉ nhắc ngắn hoặc nói ý khác.
 */
export const landing = {
  /** Liên kết đầu tiên của trang, chỉ hiện khi nhận focus bằng bàn phím. */
  skipToContent: 'Bỏ qua tới nội dung chính',
  hero: {
    /** Khoảng trắng không ngắt (`\u00a0`) giữ từ ghép trên một dòng: "doanh nghiệp", "thùng xe", "thứ tự", "theo dõi", "điểm giao". */
    eyebrow: 'Lập kế hoạch chất xếp hàng 3D cho doanh\u00a0nghiệp vận tải',
    title: 'Tận dụng thùng\u00a0xe, dỡ đúng thứ\u00a0tự, theo\u00a0dõi tới điểm\u00a0giao cuối.',
    /** Mở bằng việc điều phối viên đang khổ, rồi mới tới điều ứng dụng làm — mỗi vế đều là việc ứng dụng làm thật. */
    lede: 'Còn xếp theo kinh nghiệm, tới điểm giao phải dỡ ra xếp lại, lo quá tải trục, không chắc hàng đã lên đủ xe? LoadMaster tính phương án xếp 3D theo thứ tự giao và kiểm tải trục, rồi kho và tài xế đối chiếu từng kiện theo cùng một bản đã duyệt.',
    cta: 'Nhận tư vấn',
    pricing: 'Xem bảng giá',
    artworkLabel: 'Mô phỏng thùng xe được xếp hàng theo thứ tự dỡ',
    /**
     * Bốn vai trò **vận hành** (điều phối viên, nhân viên kho, tài xế, quản lý công ty) làm trên cùng một phương án; tên vai trò lấy từ nhánh
     * `roles`. Công ty có năm vai trò — thêm quản trị công ty, người lo tài khoản và gói cước — nên luôn ghi "vận hành".
     */
    roles: 'Một phương án cho bốn vai trò vận hành',
  },
  /**
   * Khung 3D của phần mở đầu: chuyến mẫu do bộ tối ưu mô phỏng tính ngay trên trình duyệt của người xem, vẽ bằng bộ máy 3D của ứng dụng.
   * Mọi số ở đây là số của lần chạy đó và đi kèm MOCK RESULT.
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
    caption: 'Chuyến mẫu {count} kiện cho {stops} điểm giao, do bộ tối ưu mô phỏng tính ngay trên trình duyệt của bạn rồi xếp từng kiện theo đúng thứ tự.',
    /** Câu dưới hình minh hoạ khi trình duyệt không vẽ được khung 3D: không nói gì về lần chạy, vì không có lần chạy nào. */
    artworkCaption: 'Hình minh hoạ: thùng xe xếp theo điểm giao, mỗi điểm giao một màu.',
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
  /**
   * Tính năng chính (`#tinh-nang`): mỗi ô một dòng nhãn ngắn (`kicker`, tên tính năng), tiêu đề nói lợi ích, một câu nói cách làm. Số trong
   * câu (`{count}`) lấy từ code.
   */
  features: {
    title: 'Tính năng chính',
    lede: 'Mỗi tính năng thay một việc đang làm bằng kinh nghiệm hay bằng tay: xếp hàng, chọn thứ tự giao, đếm kiện, hỏi xe đang ở đâu.',
    loading: {
      kicker: 'Xếp hàng 3D theo điểm giao',
      title: 'Xếp đúng thứ tự giao ngay từ kho',
      text: 'Thùng chia vùng theo thứ tự giao: vùng của điểm cuối nằm sâu nhất, vùng của điểm đầu sát cửa — tới điểm nào chỉ lấy hàng của điểm đó, không phải dỡ ra xếp lại. Xem, xoay và chỉnh tay phương án trong 3D.',
    },
    /** Sơ đồ thùng xe chia vùng của ô xếp hàng — chữ trong hình; `door` còn dùng ở dải nguyên tắc và cảnh của Cách hoạt động. */
    zones: {
      door: 'Cửa sau',
      zone: 'Vùng {number}',
    },
    plans: {
      kicker: 'Ba phương án',
      title: 'So ba phương án rồi mới duyệt',
      text: 'Mỗi lần chạy cho ba phương án theo ba mục tiêu. So cạnh nhau, chỉnh tay nếu cần rồi duyệt bản hợp chuyến nhất.',
    },
    verify: {
      kicker: 'Đối chiếu kiện',
      title: 'Biết chắc từng kiện đã lên xe',
      text: 'Kho quét từng kiện khi soạn và xếp, tài xế quét khi dỡ. Nhãn rách hay mất mã vẫn làm tiếp được, chờ điều phối viên duyệt.',
    },
    route: {
      kicker: 'Tuyến và giám sát',
      title: 'Biết xe đang ở đâu, điểm nào có nguy cơ trễ',
      text: 'Tối ưu thứ tự điểm giao, so giờ đến dự kiến với hạn giao, theo dõi vị trí xe và sự cố trên đường.',
      /** Kho xuất phát trên sơ đồ tuyến của ô; còn dùng ở cảnh tuyến của Cách hoạt động. */
      depot: 'Kho',
    },
    pickup: {
      kicker: 'Nhận hàng dọc đường',
      title: 'Xe đang chạy vẫn nhận thêm hàng',
      /** `{count}`: số luật kiểm, lấy từ domain. */
      text: 'Kiểm {count} luật trước khi duyệt; kiện mới vào chỗ trống của các điểm đã giao, không dời kiện nào đang chở.',
      /** Chú giải dưới hình thùng nhìn từ trên. */
      freed: 'Chỗ trống sau điểm đã giao',
      picked: 'Kiện nhận thêm',
    },
    roles: {
      kicker: 'Phân quyền theo vai trò',
      /** `{count}`: số vai trò của công ty, lấy từ code. */
      title: '{count} vai trò, mỗi người một màn phù hợp',
      text: 'Cùng một phương án đi từ bàn điều phối tới kho và xe tải; mỗi người chỉ thấy việc của mình, trên thiết bị của mình.',
    },
    /** Việc của từng vai trò trong công ty; tên vai trò lấy từ nhánh `roles`. */
    roleList: {
      dispatcher: 'Lập chuyến, chạy tối ưu, so sánh và duyệt phương án.',
      warehouse: 'Soạn và xếp từng kiện trên máy tính bảng, đối chiếu bằng mã QR.',
      driver: 'Giao theo từng điểm trên điện thoại, xem vị trí hàng trong thùng.',
      manager: 'Lập yêu cầu giao, theo dõi bảng điều khiển và xuất báo cáo.',
      companyAdmin: 'Quản lý tài khoản của công ty, gói cước và credit.',
    },
  },
  how: {
    title: 'Cách hoạt động',
    lede: 'Bốn bước của một chuyến hàng trên LoadMaster.',
    step: 'Bước {number}',
    /** Ai làm bước đó; tên vai trò lấy từ nhánh `roles`. */
    who: 'Người làm',
    /** Tên của khung dính khi đọc tới câu kết sau bốn bước. */
    done: 'Chuyến đã giao xong',
    /** Chữ trong hình của khung dính (trang trí). */
    scene: {
      requirement: 'Yêu cầu giao',
    },
    steps: {
      intake: {
        title: 'Nhập kiện và yêu cầu giao',
        text: 'Nhập kiện từ file hoặc thêm tay, in nhãn QR. Quản lý công ty lập yêu cầu giao với điểm đến và hạn giao.',
      },
      plan: {
        title: 'Lập chuyến, tối ưu tuyến',
        text: 'Điều phối viên đưa yêu cầu vào chuyến, chọn xe và tối ưu thứ tự điểm giao.',
      },
      optimize: {
        title: 'Xếp 3D, so sánh, duyệt',
        text: 'Một lần chạy cho ba phương án theo ba mục tiêu. So sánh, chỉnh tay nếu cần rồi duyệt một.',
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
} as const
