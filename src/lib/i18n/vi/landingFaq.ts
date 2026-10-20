/**
 * Mục Hỏi đáp của trang giới thiệu (`LandingFaq`, neo `#hoi-dap`). Câu trả lời chỉ nói điều ứng dụng làm được thật (AGENTS mục 1, 6, 9).
 * `items` chỉ chứa chuỗi thuần — không tham số, không đánh dấu — vì lúc dựng trang, thẻ FAQPage (JSON-LD) đọc thẳng nhánh này; bản `en`
 * giữ đúng bộ mã câu hỏi. Thứ tự câu hỏi trên trang là thứ tự khai ở đây.
 */
export const landingFaq = {
  title: 'Câu hỏi thường gặp',
  lede: 'Trả lời ngắn cho những điều nên biết trước khi gửi yêu cầu tư vấn.',
  more: 'Chưa thấy câu hỏi của bạn?',
  contact: 'Gửi câu hỏi cho đội LoadMaster',
  items: {
    whatIs: {
      q: 'LoadMaster là gì?',
      a: 'LoadMaster là hệ thống lập kế hoạch và tối ưu chất xếp hàng hoá 3D cho doanh nghiệp vận tải vừa và nhỏ. Điều phối viên lập chuyến, tối ưu tuyến và phương án xếp hàng; kho xếp và tài xế dỡ theo cùng một phương án đã duyệt.',
    },
    start: {
      q: 'Làm sao để bắt đầu dùng LoadMaster?',
      a: 'LoadMaster chưa có đăng ký hay dùng thử tự phục vụ. Bạn gửi yêu cầu liên hệ ở cuối trang; đội LoadMaster tư vấn gói cước rồi mở tài khoản cho công ty, kèm tài khoản quản trị công ty đầu tiên để mời mọi người vào.',
    },
    devices: {
      q: 'Có phải cài phần mềm không?',
      a: 'Không. LoadMaster là ứng dụng web, mở bằng trình duyệt. Điều phối viên làm trên máy tính; nhân viên kho dùng máy tính bảng, tài xế dùng điện thoại, với nút bấm lớn và chữ to.',
    },
    roles: {
      q: 'Ai trong công ty dùng LoadMaster?',
      a: 'Quản trị công ty quản lý tài khoản, gói cước và credit; quản lý công ty lập yêu cầu giao, xem bảng điều khiển và xuất báo cáo; điều phối viên lập chuyến, chạy tối ưu và duyệt phương án; nhân viên kho soạn và xếp hàng; tài xế giao theo từng điểm. Mỗi người chỉ thấy việc của vai trò mình.',
    },
    import: {
      q: 'Đưa danh sách kiện vào bằng cách nào?',
      a: 'Nhập file .xlsx theo mẫu, mỗi kiện một dòng: mã kiện, dài, rộng, cao (cm), khối lượng (kg), loại hàng, điểm đến và loại kiện nếu có. Cũng có thể thêm từng kiện bằng tay. Mỗi kiện được cấp một mã QR để in nhãn dán lên kiện.',
    },
    credit: {
      q: 'Credit được tính thế nào?',
      a: 'Mỗi lần chạy tối ưu xếp hàng 3D dùng một credit và cho ra ba phương án để so sánh. Tối ưu tuyến và tìm tuyến khác không tốn credit. Số credit mỗi tháng theo gói cước; quản trị công ty nạp thêm khi cần.',
    },
    axle: {
      q: 'LoadMaster tính tải trục thế nào?',
      a: 'Theo mô hình đòn bẩy trên dữ liệu trục khai cho từng xe: vị trí trục, tải khi xe rỗng và giới hạn. Phương án làm một trục vượt giới hạn thì không duyệt được. Xe chưa khai đủ trục thì ứng dụng không đưa ra số tải trục nào, thay vì đoán.',
    },
    data: {
      q: 'Công ty khác có thấy dữ liệu của tôi không?',
      a: 'Không. Dữ liệu tách theo công ty: người của một công ty chỉ thấy xe, kiện, yêu cầu giao, chuyến và người dùng của chính công ty đó.',
    },
    language: {
      q: 'Giao diện có tiếng Anh không?',
      a: 'Có. Giao diện chuyển qua lại giữa tiếng Việt và tiếng Anh bất cứ lúc nào mà không mất dữ liệu đang nhập.',
    },
  },
} as const
