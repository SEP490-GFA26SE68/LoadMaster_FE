import { vnTime } from './clock'
import type { PickupRequest } from './pickup-model'
import { CUSTOMERS } from './seed-directory'
import { SEED_DISPATCHER } from './seed-trips'
import { LONG_BINH } from './seed-users'

/**
 * Yêu cầu nhận dọc đường của seed (FE-7-01): một yêu cầu **chờ duyệt** trên `TRIP-009` — chuyến Đang vận chuyển duy nhất của Long Bình
 * (Thủ Dầu Một → Sóng Thần, đã giao điểm 1, xe đang ở điểm 2). Điểm nhận ở KCN VSIP 1 (Thuận An), nằm trên đường từ Thủ Dầu Một xuống
 * Sóng Thần; điểm giao là điểm 3 của chuyến — điểm được bảo vệ kế tiếp, nên trùng điểm đó. Toạ độ gần đúng ở mức khu vực
 * (`seed-places.ts`), không tới số nhà. Phương Nam không có chuyến nào đang vận chuyển nên không có yêu cầu nào. Mốc giờ neo theo
 * ngày `today` (D-44); hạn là mốc tương lai nên `seed-shift.ts` giữ nguyên giờ đã hẹn.
 */
export function seedPickups(today: string): PickupRequest[] {
  const delivery = CUSTOMERS.bepAnSongThan
  return [
    {
      id: 'PKR-001',
      companyId: LONG_BINH,
      tripId: 'TRIP-009',
      pickup: { name: 'Xưởng may Hoàng Gia', address: 'Đường số 4, KCN VSIP 1, Thuận An, Bình Dương', lat: 10.928, lng: 106.712 },
      delivery: { name: delivery.name, address: delivery.address, lat: delivery.lat, lng: delivery.lng },
      deadline: vnTime(today, '17:30'),
      packages: [
        { packageCode: 'HG-0412', lengthCm: 60, widthCm: 40, heightCm: 40, weightKg: 12, handlingClass: 'STANDARD' },
        { packageCode: 'HG-0413', lengthCm: 60, widthCm: 40, heightCm: 40, weightKg: 12, handlingClass: 'STANDARD' },
        { packageCode: 'HG-0414', lengthCm: 60, widthCm: 40, heightCm: 40, weightKg: 14.5, handlingClass: 'STANDARD' },
        { packageCode: 'HG-0415', lengthCm: 80, widthCm: 50, heightCm: 50, weightKg: 18, handlingClass: 'STANDARD' },
      ],
      status: 'PENDING',
      validationResults: [],
      createdAt: vnTime(today, '07:40'),
      createdBy: SEED_DISPATCHER,
    },
  ]
}
