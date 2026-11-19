/**
 * Trang công khai "Chính sách bảo mật" `/chinh-sach-bao-mat` (`features/marketing/privacy`). Mỗi câu nói đúng điều mã hôm nay làm — không
 * hạn lưu trữ, pháp nhân, địa chỉ hay cam kết tuân thủ nào chưa có. Câu theo nguồn dữ liệu (máy chủ hay bản demo) đứng thành cặp, trang chọn
 * một câu theo cấu hình đang chạy. `{name}` là tên riêng của trợ lý, `{roles}` là tên các vai trò, `{date}` là ngày đã định dạng.
 */
export const privacy = {
  title: 'Chính sách bảo mật',
  lede: 'LoadMaster thu dữ liệu nào, gửi tới đâu và lưu ở đâu — đúng như bản ứng dụng bạn đang mở.',
  updated: 'Cập nhật lần cuối: {date}',
  contact: {
    title: 'Form liên hệ',
    intro: 'Form liên hệ ở trang giới thiệu chỉ gửi những ô dưới đây:',
    required: '{field} (bắt buộc)',
    optional: '{field} (nếu bạn điền)',
    consent: 'Dấu tích đồng ý với chính sách này chỉ mở được nút gửi; form không gửi nó đi. Form còn một ô ẩn để nhận ra chương trình gửi tự động — ô đó cũng không được gửi đi.',
    record: 'Hệ thống ghi thêm lúc bạn gửi; khi xử lý, đội LoadMaster ghi trạng thái, người nhận việc và ghi chú nội bộ của yêu cầu.',
    handlers: 'Chỉ {roles} của đội LoadMaster đọc và xử lý yêu cầu liên hệ.',
    server: 'Yêu cầu được gửi tới máy chủ của LoadMaster.',
    demo: 'Bản demo này chưa nối máy chủ: yêu cầu chỉ nằm trong bộ nhớ của trình duyệt này (các thẻ đang mở dùng chung) và mất khi đóng hoặc tải lại mọi thẻ.',
  },
  registration: {
    title: 'Đăng ký dùng thử và đăng ký trả phí',
    trial: 'Đăng ký dùng thử gửi tới máy chủ của LoadMaster: tên công ty, mã số thuế, họ tên, email, số điện thoại, và — nếu bạn điền — địa chỉ công ty, ghi chú. Máy chủ gửi mã xác nhận tới email đó, kiểm sơ bộ thông tin, rồi đội LoadMaster duyệt yêu cầu.',
    paid: 'Đăng ký trả phí gửi tên công ty, mã công ty, mã số thuế, họ tên, email, số điện thoại, và — nếu bạn điền — địa chỉ công ty; sau mã xác nhận qua email là gói và kỳ thanh toán bạn chọn.',
    payment: 'Bước thanh toán hiện là giả lập: ứng dụng không có ô nhập số thẻ hay tài khoản ngân hàng nào.',
    off: 'Bản này chưa mở đăng ký công khai: tài khoản công ty do đội LoadMaster tạo sau khi nhận yêu cầu liên hệ.',
  },
  app: {
    title: 'Khi dùng ứng dụng',
    signIn: 'Bạn đăng nhập bằng email và mật khẩu; ứng dụng gửi chúng thẳng tới Keycloak — máy chủ đăng nhập của LoadMaster — và không lưu mật khẩu. Mã đăng nhập chỉ nằm trong bộ nhớ của thẻ; mã làm mới nằm trong sessionStorage của thẻ để tải lại trang không phải đăng nhập lại.',
    signInPage: 'Khi máy chủ đăng nhập chưa cho đăng nhập ngay trên màn của ứng dụng, ứng dụng chuyển bạn sang trang đăng nhập của Keycloak; trang đó dùng cookie riêng của Keycloak.',
    signInDemo: 'Bản demo này đăng nhập bằng tài khoản mẫu ngay trong trình duyệt; phiên nằm trong sessionStorage của thẻ.',
    tenancy: 'Mỗi tài khoản thuộc một công ty và chỉ đọc được xe, kiện, chuyến, người dùng của công ty mình.',
    maps: 'Bản đồ chỉ có trong ứng dụng, không có trên trang công khai. Khi bản cài đặt có khoá bản đồ, trình duyệt tải ảnh nền bản đồ từ Goong — nhà cung cấp bản đồ; không có khoá thì không tải gì. Ô tìm địa chỉ không gọi Goong từ trình duyệt: khi nối máy chủ, việc tìm đi qua máy chủ của LoadMaster.',
    gps: 'Vị trí điện thoại của tài xế chỉ được gửi khi tài xế bật "Dùng GPS thật" trong một chuyến đang chạy, và dừng khi tài xế tắt hoặc rời màn chuyến.',
  },
  browser: {
    title: 'Trên trình duyệt của bạn',
    storage: 'LoadMaster chỉ dùng sessionStorage của thẻ đang mở — trình duyệt xoá khi đóng thẻ — để nhớ ngôn ngữ, phiên đăng nhập và vài trạng thái tạm của màn. Ứng dụng không dùng localStorage, và mã của ứng dụng không đặt cookie.',
    tracking: 'LoadMaster không gắn công cụ thống kê truy cập, quảng cáo hay theo dõi người xem nào.',
    assistant: '{name} trả lời ngay trên trình duyệt từ tài liệu soạn sẵn: câu bạn gõ không được gửi đi và mất khi tải lại trang — trừ khi bạn chuyển câu hỏi sang form liên hệ rồi tự gửi form.',
    fonts: 'LoadMaster tải hai phông chữ từ Google Fonts, nên trình duyệt gửi yêu cầu tới máy chủ của Google.',
  },
  questions: {
    title: 'Hỏi về dữ liệu của bạn',
    body: 'Muốn hỏi về dữ liệu bạn đã gửi, hãy gửi yêu cầu qua form liên hệ.',
    action: 'Mở form liên hệ',
    email: 'Hoặc viết tới {email}.',
  },
} as const
