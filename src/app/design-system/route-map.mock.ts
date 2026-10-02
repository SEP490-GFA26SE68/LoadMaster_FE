import type { GeoPoint } from '@/domain/routing'

/**
 * Toạ độ **gần đúng** của bốn điểm giao của chuyến mẫu `TRIP-2026-0914` (seed chưa có toạ độ điểm giao — yêu cầu giao mang toạ độ
 * là việc của FE-4b-01). Ước theo địa chỉ trong seed, đủ để bày bản đồ ở `/thanh-phan`; không dùng cho nghiệp vụ.
 */
export const SAMPLE_STOP_LOCATIONS: Readonly<Record<string, GeoPoint>> = {
  /** 12 Nguyễn Văn Linh, Q.7, TP. Hồ Chí Minh */
  'STOP-01': { lat: 10.7512, lng: 106.7286 },
  /** 30 Đại lộ Bình Dương, Thủ Dầu Một */
  'STOP-02': { lat: 10.973, lng: 106.6715 },
  /** 215 Quốc lộ 1K, P. Đông Hoà, Dĩ An */
  'STOP-03': { lat: 10.8935, lng: 106.783 },
  /** 58 Võ Thị Sáu, P. Quyết Thắng, Biên Hoà */
  'STOP-04': { lat: 10.947, lng: 106.824 },
}

/** Giờ xuất phát mẫu (giờ Việt Nam) của ngày chạy chuyến. Không điểm mẫu nào có hạn nên giờ này không đổi số nào trên thẻ. */
export const SAMPLE_DEPARTURE_TIME = '08:00:00+07:00'
