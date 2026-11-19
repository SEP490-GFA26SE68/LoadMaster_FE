/**
 * Trang giới thiệu công khai `/gioi-thieu` (`features/marketing`): đầu trang dùng chung với Bảng giá, phần mở đầu và khung 3D, gói cước
 * và form liên hệ của khách; ba chuyện quen thuộc và "Một chuyến hàng" ở nhánh `landingJourney`, chân trang ở nhánh `landingFooter`. Chỉ nói điều ứng dụng làm
 * được thật: không tên hay lời khen của khách hàng; số nào cũng có câu nguồn — lần chạy của bộ tối ưu mô phỏng trên trình duyệt, hằng số
 * trong code, hoặc danh mục gói. Trang công khai không hiện nhãn MOCK RESULT: câu nguồn nói thay.
 */
export const landing = {
  /** Liên kết đầu tiên của trang, chỉ hiện khi nhận focus bằng bàn phím. */
  skipToContent: 'Bỏ qua tới nội dung chính',
  header: {
    nav: 'Mục của trang giới thiệu',
    menu: 'Menu trang',
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
    title: 'Tới điểm nào, mở cửa là thấy hàng của điểm đó.',
    lede: 'LoadMaster lập phương án xếp hàng 3D theo đúng thứ tự giao. Điều phối viên duyệt, kho xếp theo phương án, tài xế dỡ đúng hàng ở từng điểm.',
    cta: 'Nhận tư vấn',
    pricing: 'Xem bảng giá',
    artworkLabel: 'Mô phỏng thùng xe được xếp hàng theo thứ tự dỡ',
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
  },
  /** Tên bốn điểm giao của chuyến mẫu — khung 3D ghi tên này trên dải vùng; bản tiếng Anh không có chữ có dấu. */
  sample: {
    stop1: 'Siêu thị',
    stop2: 'Cửa hàng tiện lợi',
    stop3: 'Nhà phân phối',
    stop4: 'Đại lý tạp hoá',
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
    /** Thanh kéo "số lần chạy mỗi tháng" dưới các gói — cùng phép tính với trợ lý Lumo (`assistant-advisor.ts`). */
    advisor: {
      label: 'Mỗi tháng công ty bạn chạy tối ưu 3D khoảng bao nhiêu lần?',
      runs: { one: '{count} lần mỗi tháng', other: '{count} lần mỗi tháng' },
      math: {
        one: '{count} lần × {cost} credit = {credits} credit mỗi tháng.',
        other: '{count} lần × {cost} credit = {credits} credit mỗi tháng.',
      },
      pick: 'Gói rẻ nhất đủ dùng: {name}.',
      none: 'Chưa có gói đang bán nào đủ {credits} credit mỗi tháng — để lại thông tin ở form liên hệ để được tư vấn.',
      /** Nhãn trên thẻ gói rẻ nhất đủ dùng. */
      fits: 'Rẻ nhất đủ dùng',
      caveat: 'Ước tính theo số lần chạy bạn chọn.',
    },
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
      /** Ô đồng ý bắt buộc: chữ trước, liên kết tới chính sách bảo mật (mở thẻ mới để dữ liệu đang nhập còn nguyên), chữ sau. */
      consent: {
        before: 'Tôi đã đọc và đồng ý với ',
        link: 'chính sách bảo mật',
        after: '.',
        newTab: '(mở trong thẻ mới)',
      },
      /** Ô bẫy ẩn — người thật không thấy, chương trình gửi tự động hay điền; chỉ để nhãn của ô không trống. */
      trap: 'Để trống ô này',
      /** Lần gửi bị chặn vì trông như chương trình tự động (ô bẫy có chữ, hoặc gửi ngay sau khi form hiện). Dữ liệu đang nhập giữ nguyên. */
      blocked: 'Chưa gửi được: lần gửi này trông như của chương trình tự động. Bạn kiểm lại các ô rồi bấm "Gửi yêu cầu" lần nữa.',
      errors: {
        fullNameRequired: 'Nhập họ tên',
        fullNameTooLong: 'Họ tên tối đa {max} ký tự',
        emailRequired: 'Nhập email',
        emailInvalid: 'Email không đúng định dạng',
        emailTooLong: 'Email tối đa {max} ký tự',
        phoneTooLong: 'Số điện thoại tối đa {max} ký tự',
        companyTooLong: 'Tên công ty tối đa {max} ký tự',
        messageTooLong: 'Nội dung tối đa {max} ký tự',
        consentRequired: 'Đánh dấu ô đồng ý để gửi yêu cầu',
      },
    },
    sent: {
      title: 'Đã ghi nhận yêu cầu {id}',
      text: 'Đội LoadMaster sẽ liên hệ lại qua email bạn đã nhập.',
      again: 'Gửi yêu cầu khác',
    },
  },
} as const
