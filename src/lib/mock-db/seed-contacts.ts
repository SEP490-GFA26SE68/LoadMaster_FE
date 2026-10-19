import type { GuestContact } from './contact-model'

const HOUR_MS = 60 * 60 * 1000

/**
 * Ba yêu cầu liên hệ của khách trong seed: một **Mới** (chưa ai nhận), một **Đang xử lý** giao cho Hỗ trợ khách hàng seed (`US-NT-02`), một
 * **Đã giải quyết**. Mốc giờ tính lùi từ `now` của kho nên không yêu cầu nào ở tương lai. Không có sự kiện nhật ký đi kèm: mã sự kiện của
 * seed không đổi. Gói quan tâm trỏ vào danh mục gói của seed (`SEED_PLANS`).
 */
export function seedContacts(now: Date): GuestContact[] {
  const at = (hoursAgo: number) => new Date(now.getTime() - hoursAgo * HOUR_MS).toISOString()
  return [
    {
      id: 'LH-001', fullName: 'Lê Hoàng Nam', email: 'nam.le@vantaiminhphat.vn', phoneNumber: '0903 412 875',
      companyName: 'Công ty TNHH Vận tải Minh Phát', interestedPlanId: 'PLAN-002', requestType: 'PRICING',
      message: 'Công ty có 12 xe tải 5–8 tấn chạy tuyến Bình Dương – Đồng Nai. Cần báo giá gói Pro cho năm người điều phối và hỏi cách nhập kiện từ file Excel.',
      status: 'NEW', createdAt: at(2),
    },
    {
      id: 'LH-002', fullName: 'Phạm Thu Trang', email: 'trang.pham@giaonhanhoaan.com', phoneNumber: '0938 220 641',
      companyName: 'Giao nhận Hoà An', requestType: 'DEMO_REQUEST',
      message: 'Muốn xem thử phần xếp hàng 3D và màn của tài xế trước khi quyết định. Có thể hẹn buổi giới thiệu vào chiều thứ Năm không?',
      status: 'IN_PROGRESS', assignedToId: 'US-NT-02', assignedToName: 'Tạ Thị Ngọc Ánh',
      note: 'Đã gọi điện, hẹn giới thiệu trực tuyến 14:00 thứ Năm.', createdAt: at(30),
    },
    {
      id: 'LH-003', fullName: 'Trần Quốc Bảo', email: 'bao.tran@logisticsvietbac.vn', requestType: 'INQUIRY',
      message: 'Ứng dụng có dùng được trên máy tính bảng ở kho không, hay chỉ trên máy tính?',
      status: 'RESOLVED', assignedToId: 'US-NT-02', assignedToName: 'Tạ Thị Ngọc Ánh',
      note: 'Đã trả lời qua email: kho dùng máy tính bảng, tài xế dùng điện thoại.', createdAt: at(74), resolvedAt: at(70),
    },
  ]
}
