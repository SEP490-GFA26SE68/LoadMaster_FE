/**
 * Trang chính sách bảo mật công khai `/chinh-sach-bao-mat` (`features/marketing/privacy`). Mọi câu nói đúng điều mã nguồn đang làm: ô của
 * form liên hệ (`CONTACT_FORM_FIELDS`), ai xem được (`CONTACT_HANDLER_ROLES`), nơi lưu theo nguồn dữ liệu (`GUEST_CONTACT_SOURCE`), bộ nhớ
 * trình duyệt (`sessionStorage` cho ngôn ngữ và phiên). Không thời hạn lưu nào tự nghĩ ra. Bản nháp, chờ bộ phận pháp lý duyệt.
 */
export const legal = {
  title: 'Chính sách bảo mật',
  lede: 'LoadMaster thu thập gì khi bạn gửi yêu cầu liên hệ, dùng vào việc gì, lưu ở đâu và bạn có quyền gì với thông tin đó.',
  draft: 'Bản nháp — chờ bộ phận pháp lý duyệt',
  draftNote: 'Trang này mô tả đúng cách bản web hiện tại xử lý thông tin của bạn nhưng chưa được bộ phận pháp lý duyệt. Nội dung có thể đổi trước khi dịch vụ chạy chính thức.',
  toc: 'Mục lục',
  collect: {
    title: 'Thông tin thu thập',
    intro: 'Form liên hệ ở trang giới thiệu hỏi những thông tin sau:',
    required: 'bắt buộc',
    optional: 'không bắt buộc',
    system: 'Hệ thống ghi thêm thời điểm bạn gửi, trạng thái xử lý, người của LoadMaster nhận việc và ghi chú nội bộ của họ.',
    consent: 'Bạn đánh dấu ô đồng ý trước khi gửi; không đánh dấu thì form không gửi gì.',
  },
  purpose: {
    title: 'Dùng vào việc gì',
    consult: 'Liên hệ lại với bạn để tư vấn gói, báo giá, hẹn xem demo hay bàn hợp đồng — đúng việc bạn chọn ở ô “{type}”.',
    account: 'Mở tài khoản công ty khi hai bên đồng ý dùng LoadMaster.',
    never: 'Trang web không gửi thông tin này cho dịch vụ quảng cáo hay công cụ đo lượt truy cập nào.',
  },
  storage: {
    title: 'Lưu ở đâu',
    demo: 'Ở bản demo, yêu cầu chỉ nằm trong bộ nhớ của trình duyệt bạn đang dùng: các thẻ đang mở của trang dùng chung nó, và nó mất khi bạn đóng hoặc tải lại mọi thẻ. Không gì được gửi tới máy chủ.',
    server: 'Khi dịch vụ chạy chính thức, yêu cầu được gửi tới máy chủ của LoadMaster và lưu ở đó.',
    /** Dòng nói trang đang mở chạy theo cách nào — đọc từ nguồn dữ liệu của form liên hệ. */
    nowDemo: 'Trang bạn đang mở là bản demo: yêu cầu gửi từ đây chỉ nằm trong trình duyệt này.',
    nowServer: 'Trang bạn đang mở gửi yêu cầu tới máy chủ của LoadMaster.',
  },
  access: {
    title: 'Ai xem được',
    intro: 'Chỉ nhân viên LoadMaster ở ba vai trò sau, để xử lý yêu cầu của bạn:',
    companies: 'Công ty đang dùng LoadMaster không xem được yêu cầu liên hệ của khách.',
  },
  retention: {
    title: 'Lưu bao lâu',
    text: 'Tới khi yêu cầu của bạn được xử lý xong, hoặc tới khi bạn yêu cầu xoá. Thời hạn lưu cụ thể sẽ ghi ở đây khi bộ phận pháp lý chốt.',
  },
  rights: {
    title: 'Quyền của bạn',
    view: 'Xem thông tin LoadMaster đang giữ về bạn.',
    edit: 'Sửa thông tin sai hoặc đã cũ.',
    delete: 'Xoá yêu cầu và thông tin liên hệ của bạn.',
    how: 'Gửi email tới hộp thư hỗ trợ, ghi rõ email bạn đã dùng trong form:',
  },
  browser: {
    title: 'Bộ nhớ trình duyệt và cookie',
    session: 'Ứng dụng dùng sessionStorage của thẻ trình duyệt để nhớ ngôn ngữ bạn chọn và phiên đăng nhập; đóng thẻ là mất.',
    none: 'Trang web không dùng cookie quảng cáo, không dùng công cụ đo lượt truy cập và không lưu thông tin bạn nhập vào bộ nhớ lâu dài của trình duyệt.',
    signIn: 'Khi đăng nhập qua máy chủ xác thực của LoadMaster, thư viện đăng nhập giữ tạm một mã kiểm tra trong bộ nhớ trình duyệt suốt lúc chuyển trang rồi xoá; máy chủ xác thực đặt cookie phiên đăng nhập của riêng nó.',
    /** Phông Be Vietnam Pro và JetBrains Mono nạp từ Google Fonts ở `index.html`. */
    fonts: 'Trang tải phông chữ từ Google Fonts, nên trình duyệt của bạn gửi địa chỉ IP tới máy chủ của Google khi tải phông.',
  },
  contact: {
    title: 'Liên hệ',
    intro: 'Câu hỏi về chính sách này hay về thông tin của bạn, gửi tới:',
    email: 'Email',
    phone: 'Điện thoại',
    address: 'Địa chỉ',
    taxCode: 'Mã số thuế',
  },
  back: 'Về trang giới thiệu',
} as const
