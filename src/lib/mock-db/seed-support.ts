import { LONG_BINH, PHUONG_NAM } from './seed-users'
import type { SupportTicket } from './support-model'

const HOUR_MS = 60 * 60 * 1000
const MINUTE_MS = 60 * 1000

/**
 * Hai yêu cầu hỗ trợ của seed (FE-8-07), mỗi công ty một: Long Bình có một yêu cầu kỹ thuật đang **Mở** (chưa ai trả lời), Phương Nam có
 * một yêu cầu thanh toán đã **Đóng** sau hai lần trả lời. Người gửi là điều phối viên của công ty — tài khoản `viewer` của test cách ly
 * (người của công ty chỉ thấy yêu cầu do mình gửi). Mốc giờ tính lùi từ `now` của kho nên không yêu cầu nào ở tương lai. Không có sự
 * kiện nhật ký đi kèm: mã sự kiện của seed không đổi.
 */
export function seedSupport(now: Date): SupportTicket[] {
  const at = (hoursAgo: number, plusMinutes = 0) => new Date(now.getTime() - hoursAgo * HOUR_MS + plusMinutes * MINUTE_MS).toISOString()
  const closedAt = at(26, 130)
  return [
    {
      id: 'TKT-001', companyId: LONG_BINH, senderId: 'US-0001', senderName: 'Nguyễn Thanh Tùng', kind: 'TECHNICAL',
      title: 'Planner tải chậm với phương án nhiều kiện',
      description: 'Mở phương án của chuyến có hơn 2.000 kiện thì khung 3D mất khoảng 20 giây mới xoay được. Máy dùng Chrome, card đồ hoạ tích hợp.',
      status: 'OPEN', replies: [], createdAt: at(3), updatedAt: at(3),
    },
    {
      id: 'TKT-002', companyId: PHUONG_NAM, senderId: 'US-PN-03', senderName: 'Kiều Anh Tuấn', kind: 'BILLING',
      title: 'Hỏi cách nạp thêm credit',
      description: 'Số dư credit của công ty còn rất ít. Nhờ hỗ trợ hướng dẫn nạp thêm trước khi chạy tối ưu các chuyến tuần sau.',
      status: 'CLOSED',
      replies: [
        {
          authorId: 'US-NT-02', authorName: 'Tạ Thị Ngọc Ánh', authorRole: 'systemSupporter',
          text: 'Quản trị công ty vào Gói cước và credit, chọn Nạp credit (gói 50 hoặc 500 credit) rồi thanh toán.', at: at(26, 40),
        },
        { authorId: 'US-PN-03', authorName: 'Kiều Anh Tuấn', authorRole: 'dispatcher', text: 'Đã nhờ quản trị công ty nạp, cảm ơn bạn.', at: closedAt },
      ],
      createdAt: at(26), updatedAt: closedAt,
    },
  ]
}
