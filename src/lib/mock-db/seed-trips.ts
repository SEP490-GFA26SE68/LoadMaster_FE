import type { CargoKey, CustomerKey } from './seed-directory'
import type { DeliveryIssueKind } from './types'

/** Kết cục của chuyến seed: pha vận hành, riêng pha lập kế hoạch tách theo revision (D-45). */
export type TripOutcome = 'completed' | 'cancelled' | 'delivering' | 'loaded' | 'loading' | 'optimized' | 'stale' | 'draft'

export type TripSpec = {
  id: string
  name: string
  /** Ngày chạy tính từ ngày neo: âm là đã qua. */
  day: number
  vehicleId: string
  driverId: string | null
  /** Nhân viên kho bấm xếp (Long Bình: US-0003, Sóng Thần: US-0011). */
  warehouseId: string
  stops: readonly CustomerKey[]
  /** Dòng kiện: loại hàng, số lượng, số điểm giao. Mã kiện `PKG-001`… theo thứ tự dòng. */
  lines: readonly (readonly [CargoKey, number, number])[]
  outcome: TripOutcome
  /** Kho báo thiếu kiện ở bước xếp thứ n (1-based). */
  missingAtStep?: number
  /** Sự cố giao: `first`/`last` là kiện dỡ đầu/cuối của điểm đó. */
  issues?: readonly { stop: number; pick: 'first' | 'last'; kind: DeliveryIssueKind; note: string }[]
  cancelReason?: string
  /** `loading`: số bước kho đã ghi. */
  loadedSteps?: number
  /** `delivering`: số điểm đã hoàn tất. */
  stopsDone?: number
  /** `stale`: dòng kiện được sửa số lượng sau khi duyệt. */
  staleEdit?: { line: number; quantity: number }
}

/**
 * 14 chuyến quanh chuyến chính `TRIP-2026-0914` (D-44), trải 27 ngày trước tới 2 ngày sau ngày neo: 7 hoàn thành (có kiện thiếu
 * ở kho, hàng hỏng, khách từ chối), 1 huỷ, 1 đang giao, 1 đã xếp xong (tài xế demo), 1 đang xếp, 1 đã tối ưu, 1 cần xem lại, 1 nháp.
 * Hôm nay: VEHICLE-003, 006, 007 đang chạy; VEHICLE-008 bảo dưỡng.
 */
export const TRIP_SPECS: readonly TripSpec[] = [
  {
    id: 'TRIP-001', name: 'Tuyến Thủ Đức – Dĩ An – Biên Hoà', day: -27, vehicleId: 'VEHICLE-003', driverId: 'US-0006', warehouseId: 'US-0003',
    stops: ['bhxThuDuc', 'bhxDiAn', 'coopBienHoa'],
    lines: [['nuocSuoi', 100, 1], ['miGoi', 70, 2], ['dauAn', 60, 3]],
    outcome: 'completed',
  },
  {
    id: 'TRIP-002', name: 'Tuyến Q.7 – An Phú – Phú Nhuận', day: -24, vehicleId: 'VEHICLE-002', driverId: 'US-0004', warehouseId: 'US-0003',
    stops: ['thucPhamSaiGon', 'lotteQ7', 'megaAnPhu', 'circleKPhuNhuan'],
    lines: [['suaHop', 50, 1], ['nuocGiat', 70, 2], ['banhQuy', 50, 3], ['nuocSuoi', 90, 4]],
    outcome: 'completed',
  },
  {
    id: 'TRIP-003', name: 'Tuyến Thủ Dầu Một – Quận 1 – Tân Bình', day: -20, vehicleId: 'VEHICLE-005', driverId: 'US-0007', warehouseId: 'US-0011',
    stops: ['phuongNamTdm', 'mamNonHoaSen', 'haiHaTanBinh'],
    lines: [['sachGiaoKhoa', 60, 1], ['vanPhongPham', 45, 2], ['banhQuy', 40, 3]],
    outcome: 'completed', missingAtStep: 7,
  },
  {
    id: 'TRIP-004', name: 'Tuyến Tân An – Biên Hoà', day: -17, vehicleId: 'VEHICLE-006', driverId: 'US-0010', warehouseId: 'US-0003',
    stops: ['dienMayLongAn', 'coopBienHoa'],
    lines: [['quatDien', 50, 1], ['noiComDien', 60, 1], ['nuocGiat', 60, 2]],
    outcome: 'cancelled', cancelReason: 'Khách hoãn nhận hàng do kiểm kê kho cuối tháng',
  },
  {
    id: 'TRIP-005', name: 'Tuyến Sóng Thần – Dĩ An – Thủ Dầu Một', day: -14, vehicleId: 'VEHICLE-006', driverId: 'US-0010', warehouseId: 'US-0003',
    stops: ['bepAnSongThan', 'bhxDiAn', 'coopBinhDuong'],
    lines: [['gao', 70, 1], ['dauAn', 45, 1], ['miGoi', 55, 2], ['suaHop', 30, 3]],
    outcome: 'completed',
    issues: [{ stop: 2, pick: 'first', kind: 'damaged', note: 'Thùng móp góc do xóc đường, khách vẫn nhận' }],
  },
  {
    id: 'TRIP-006', name: 'Tuyến hàng lạnh Tân Uyên – Q.7 – Q.3', day: -10, vehicleId: 'VEHICLE-004', driverId: 'US-0006', warehouseId: 'US-0011',
    stops: ['khoLanhTanUyen', 'lotteQ7', 'huongViet'],
    lines: [['thitDongLanh', 70, 1], ['haiSanDongLanh', 70, 2], ['thitDongLanh', 35, 3]],
    outcome: 'completed',
  },
  {
    id: 'TRIP-007', name: 'Tuyến vật tư y tế Biên Hoà – Bình Chánh', day: -7, vehicleId: 'VEHICLE-003', driverId: 'US-0004', warehouseId: 'US-0003',
    stops: ['benhVienDongNai', 'longChauBienHoa', 'duocBinhChanh'],
    lines: [['vatTuYTe', 30, 1], ['vatTuYTe', 15, 2], ['vanPhongPham', 40, 3]],
    outcome: 'completed',
    issues: [{ stop: 2, pick: 'last', kind: 'refused', note: 'Nhà thuốc từ chối nhận vì sai số lô' }],
  },
  {
    id: 'TRIP-008', name: 'Tuyến Biên Hoà – Thủ Đức – Bình Thạnh – Q.3', day: -3, vehicleId: 'VEHICLE-007', driverId: 'US-0007', warehouseId: 'US-0011',
    stops: ['vatLieuHoangPhat', 'megaAnPhu', 'phucLongBinhThanh', 'huongViet'],
    lines: [['gachOp', 100, 1], ['nuocGiat', 110, 2], ['caPheHat', 70, 3], ['nuocSuoi', 120, 4]],
    outcome: 'completed',
  },
  {
    id: 'TRIP-009', name: 'Tuyến Thủ Dầu Một – Sóng Thần', day: 0, vehicleId: 'VEHICLE-006', driverId: 'US-0006', warehouseId: 'US-0003',
    stops: ['coopBinhDuong', 'phuongNamTdm', 'bepAnSongThan'],
    lines: [['suaHop', 40, 1], ['sachGiaoKhoa', 50, 2], ['gao', 70, 3]],
    outcome: 'delivering', stopsDone: 1,
  },
  {
    id: 'TRIP-010', name: 'Tuyến Thủ Đức – An Phú – Phú Nhuận', day: 0, vehicleId: 'VEHICLE-003', driverId: 'US-0004', warehouseId: 'US-0003',
    stops: ['bhxThuDuc', 'megaAnPhu', 'circleKPhuNhuan'],
    lines: [['nuocSuoi', 80, 1], ['dauAn', 40, 1], ['banhQuy', 45, 2], ['miGoi', 45, 3]],
    outcome: 'loaded',
  },
  {
    id: 'TRIP-011', name: 'Tuyến Tân Bình – Q.1 – Q.7', day: 0, vehicleId: 'VEHICLE-007', driverId: 'US-0007', warehouseId: 'US-0011',
    stops: ['haiHaTanBinh', 'mamNonHoaSen', 'lotteQ7', 'thucPhamSaiGon'],
    lines: [['banhQuy', 80, 1], ['sachGiaoKhoa', 60, 2], ['nuocGiat', 80, 3], ['suaHop', 60, 4]],
    outcome: 'loading', loadedSteps: 110,
  },
  {
    id: 'TRIP-012', name: 'Tuyến Bình Chánh – Biên Hoà', day: 1, vehicleId: 'VEHICLE-005', driverId: 'US-0010', warehouseId: 'US-0003',
    stops: ['duocBinhChanh', 'benhVienDongNai'],
    lines: [['vatTuYTe', 20, 1], ['vanPhongPham', 50, 2]],
    outcome: 'optimized',
  },
  {
    id: 'TRIP-013', name: 'Tuyến Biên Hoà – Long Bình Tân', day: 1, vehicleId: 'VEHICLE-001', driverId: 'US-0007', warehouseId: 'US-0003',
    stops: ['coopBienHoa', 'vatLieuHoangPhat'],
    lines: [['nuocGiat', 80, 1], ['nuocSuoi', 60, 1], ['gachOp', 60, 2]],
    outcome: 'stale', staleEdit: { line: 0, quantity: 86 },
  },
  {
    id: 'TRIP-014', name: 'Tuyến Tân An – Dĩ An', day: 2, vehicleId: 'VEHICLE-001', driverId: null, warehouseId: 'US-0003',
    stops: ['dienMayLongAn', 'bhxDiAn'],
    lines: [['quatDien', 40, 1], ['noiComDien', 40, 1], ['nuocSuoi', 60, 2]],
    outcome: 'draft',
  },
]

/** Xe bảo dưỡng trong seed (D-53): bật 4 ngày trước ngày neo. */
export const MAINTENANCE_SPEC = { vehicleId: 'VEHICLE-008', daysAgo: 4, time: '09:15', note: 'Thay má phanh và bảo dưỡng định kỳ 20.000 km' } as const

/** Người điều phối làm mọi thao tác lập kế hoạch trong seed (trừ duyệt). */
export const SEED_DISPATCHER = 'US-0001'
/** Quản lý công ty duyệt mọi phương án trong seed (LM-104). */
export const SEED_MANAGER = 'US-0002'
export const SEED_ADMIN = 'US-0005'
