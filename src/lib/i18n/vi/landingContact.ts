/**
 * Form liên hệ của khách trên trang giới thiệu (`ContactForm`, `ContactSection`): ô đồng ý dùng thông tin kèm liên kết tới chính sách bảo
 * mật, chống gửi tự động (ô bẫy, thời gian điền tối thiểu) và câu nói thật ở bản demo — yêu cầu chỉ nằm trong trình duyệt. Nhãn các ô,
 * lỗi độ dài và vùng "Đã ghi nhận" ở `landing.contact`.
 */
export const landingContact = {
  title: 'Liên hệ',
  consent: {
    label: 'Tôi đồng ý để LoadMaster dùng thông tin này để liên hệ tư vấn',
    privacy: 'Đọc chính sách bảo mật',
    /** Chỉ cho trình đọc màn hình, sau tên liên kết. */
    newTab: '(mở thẻ mới)',
  },
  errors: {
    consentRequired: 'Đánh dấu ô đồng ý để gửi yêu cầu',
  },
  /** Nhãn của ô bẫy: ẩn với người xem và trình đọc màn hình, chỉ trình gửi tự động thấy và điền. */
  trap: 'Trang web công ty',
  /** Ô bẫy có chữ hoặc gửi quá nhanh: không lưu, không báo thành công giả, không nói lý do. */
  retry: 'Chưa gửi được yêu cầu. Vui lòng thử lại sau giây lát.',
  /** Bản demo (kho mẫu): yêu cầu chỉ lưu trong trình duyệt này. Email hỗ trợ đứng ngay sau câu, là liên kết `mailto:`. */
  demo: {
    label: 'Bản demo',
    note: 'Yêu cầu chỉ được lưu trong trình duyệt này, đội LoadMaster không nhận được. Cách nhanh nhất để gặp đội là gửi email tới',
    sent: 'Bản demo chỉ lưu yêu cầu trong trình duyệt này nên đội LoadMaster chưa nhận được. Muốn được tư vấn, gửi email tới',
  },
} as const
