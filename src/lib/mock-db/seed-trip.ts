import type { CargoPackage } from '@/domain/models'
import { addDays, SEED_ANCHOR_DATE, vnTime } from './clock'
import { HERO_DEPARTURE_TIME, LONG_BINH_DEPOT } from './seed-depots'
import { LONG_BINH } from './seed-users'
import type { Trip } from './types'

type CargoLine = Pick<
  CargoPackage,
  'id' | 'name' | 'lengthCm' | 'widthCm' | 'heightCm' | 'weightKg' | 'quantity' | 'deliveryStop' | 'maxTopLoadKg' | 'maxStackCount'
> &
  Partial<CargoPackage>

/** Mặc định của hàng tạp hoá trong chuyến mẫu: giữ đứng, xếp chồng được, đỡ tối thiểu 80%, bắt buộc xếp. Dòng kiện ghi đè phần khác. */
function cargo(line: CargoLine): CargoPackage {
  return {
    allowedOrientations: ['LWH', 'WLH'],
    keepUpright: true,
    fragilityLevel: 'NONE',
    stackable: true,
    minSupportRatio: 0.8,
    priority: 1,
    mustLoad: true,
    ...line,
  }
}

/**
 * Chuyến mẫu TRIP-2026-0914 từ Kho Long Bình: 6 dòng kiện, 132 instance, 5.844 kg, 16,55 m³ trên Hyundai HD210 (41% thể tích,
 * 62% tải). `maxTopLoadKg` mỗi dòng chịu được cả cột `maxStackCount` kiện cùng loại. `groupId` là mã đơn hàng.
 * Là chuyến chính của ngày neo (D-44): chạy ngày `today`, gán tài xế demo, đã duyệt và chờ kho xếp (revision ở `seed-revisions`).
 */
export function seedTrip(today: string = SEED_ANCHOR_DATE): Trip {
  return {
    id: 'TRIP-2026-0914',
    companyId: LONG_BINH,
    name: 'Tuyến Q.7 – Thủ Dầu Một – Dĩ An – Biên Hoà',
    vehicleId: 'VEHICLE-002',
    scheduledDate: today,
    departureAt: vnTime(today, HERO_DEPARTURE_TIME),
    depot: LONG_BINH_DEPOT,
    driverId: 'US-0004',
    phase: 'planning',
    createdAt: vnTime(addDays(today, -1), '15:20'),
    stops: [
      { id: 'STOP-01', name: 'Công ty TNHH Thực phẩm Sài Gòn', address: '12 Nguyễn Văn Linh, Q.7, TP. Hồ Chí Minh', phone: '0283 775 1122', contactName: 'Chị Hương' },
      { id: 'STOP-02', name: 'Siêu thị Co.opmart Bình Dương', address: '30 Đại lộ Bình Dương, Thủ Dầu Một', phone: '0274 382 6655', contactName: 'Anh Phúc' },
      { id: 'STOP-03', name: 'Kho Bách Hoá Xanh Dĩ An', address: '215 Quốc lộ 1K, P. Đông Hoà, Dĩ An', phone: '0909 318 204', contactName: 'Anh Toàn' },
      { id: 'STOP-04', name: 'Nhà thuốc Long Châu Biên Hoà', address: '58 Võ Thị Sáu, P. Quyết Thắng, Biên Hoà', phone: '0251 382 7719', contactName: 'Chị Ngân' },
    ],
    packages: [
      cargo({
        id: 'PKG-001',
        name: 'Thùng nhựa nguyên liệu chế biến',
        lengthCm: 60,
        widthCm: 50,
        heightCm: 50,
        weightKg: 48,
        quantity: 38,
        deliveryStop: 1,
        maxTopLoadKg: 150,
        maxStackCount: 4,
        priority: 2,
        groupId: 'DH-51027',
      }),
      cargo({
        id: 'PKG-002',
        name: 'Thùng sữa tươi tiệt trùng 48 hộp',
        lengthCm: 60,
        widthCm: 40,
        heightCm: 40,
        weightKg: 52,
        quantity: 35,
        deliveryStop: 2,
        maxTopLoadKg: 160,
        maxStackCount: 4,
        fragilityLevel: 'LOW',
        priority: 2,
        groupId: 'DH-51031',
      }),
      cargo({
        id: 'PKG-003',
        name: 'Thùng ly thuỷ tinh',
        lengthCm: 40,
        widthCm: 30,
        heightCm: 25,
        weightKg: 13.5,
        quantity: 11,
        deliveryStop: 2,
        maxTopLoadKg: 30,
        maxStackCount: 3,
        fragilityLevel: 'HIGH',
        minSupportRatio: 1,
        mustLoad: false,
        groupId: 'DH-51031',
        notes: 'Hàng dễ vỡ, không đặt dưới kiện nặng',
      }),
      cargo({
        id: 'PKG-004',
        name: 'Sọt nhựa trái cây',
        lengthCm: 70,
        widthCm: 50,
        heightCm: 50,
        weightKg: 45,
        quantity: 16,
        deliveryStop: 3,
        maxTopLoadKg: 135,
        maxStackCount: 4,
        fragilityLevel: 'MEDIUM',
        groupId: 'DH-51035',
      }),
      cargo({
        id: 'PKG-005',
        name: 'Thùng trứng gà 100 quả',
        lengthCm: 40,
        widthCm: 30,
        heightCm: 25,
        weightKg: 6.5,
        quantity: 11,
        deliveryStop: 3,
        maxTopLoadKg: 15,
        maxStackCount: 3,
        fragilityLevel: 'HIGH',
        minSupportRatio: 1,
        groupId: 'DH-51035',
        notes: 'Hàng dễ vỡ, không đặt dưới kiện nặng',
      }),
      cargo({
        id: 'PKG-006',
        name: 'Kiện thuốc và vật tư y tế',
        lengthCm: 80,
        widthCm: 60,
        heightCm: 40,
        weightKg: 60,
        quantity: 21,
        deliveryStop: 4,
        maxTopLoadKg: 120,
        maxStackCount: 3,
        allowedOrientations: ['LWH', 'LHW', 'WLH', 'WHL', 'HLW', 'HWL'],
        keepUpright: false,
        fragilityLevel: 'LOW',
        priority: 3,
        groupId: 'DH-51036',
      }),
    ],
    inputVersion: 1,
  }
}
