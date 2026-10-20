/**
 * Thẻ meta của ba trang công khai cho công cụ tìm kiếm và ô xem trước khi chia sẻ liên kết: `route-title.ts` đặt lúc chạy theo ngôn ngữ
 * đang chọn, plugin `seo` của `vite.config.ts` ghi bản tiếng Việt vào HTML lúc build. Chỉ nói điều ứng dụng làm được thật, không số liệu.
 * File thuần (không import): `vite.config.ts` đọc thẳng nó.
 */
export const seo = {
  /** Mô tả ảnh xem trước `/og-image.png` (logo, thùng xe xếp kiện theo màu điểm giao). */
  imageAlt: 'Logo LoadMaster và thùng xe tải xếp kiện theo màu điểm giao',
  pages: {
    landing: {
      title: 'LoadMaster — Lập kế hoạch xếp hàng 3D cho xe tải',
      description:
        'Lập chuyến, tối ưu tuyến và phương án xếp hàng 3D theo điểm giao cho doanh nghiệp vận tải. Kho xếp và tài xế dỡ theo cùng một phương án đã duyệt.',
    },
    pricing: {
      title: 'Bảng giá · LoadMaster',
      description:
        'Các gói LoadMaster tính theo số lần chạy tối ưu xếp hàng 3D mỗi tháng; tối ưu tuyến không tốn credit. Gửi yêu cầu để được tư vấn gói hợp với đội xe.',
    },
    privacy: {
      title: 'Chính sách bảo mật · LoadMaster',
      description: 'Cách LoadMaster dùng và bảo vệ thông tin bạn gửi qua form liên hệ trên trang giới thiệu.',
    },
  },
} as const
