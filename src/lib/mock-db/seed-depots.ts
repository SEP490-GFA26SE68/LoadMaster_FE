import type { CompanyDepot } from './source-types'

/**
 * Kho xuất phát của hai công ty seed (PRD v2 mục 5.3, D-76) — kho của công ty và kho đi mặc định của mọi chuyến seed. Toạ độ gần đúng ở
 * mức khu vực, không tới số nhà: KCN Biên Hoà 2 (Biên Hoà, Đồng Nai) và phường Phú Thuận (Quận 7).
 */
export const LONG_BINH_DEPOT: CompanyDepot = { name: 'Kho Long Bình', address: '9 Đường 3A, KCN Biên Hoà 2, Biên Hoà, Đồng Nai', lat: 10.9294, lng: 106.8747 }

export const PHUONG_NAM_DEPOT: CompanyDepot = { name: 'Kho Phú Thuận', address: '102 Nguyễn Văn Quỳ, P. Phú Thuận, Quận 7, TP. Hồ Chí Minh', lat: 10.7308, lng: 106.7353 }

/**
 * Giờ xuất phát theo kế hoạch của chuyến seed (giờ Việt Nam): kho bắt đầu xếp 04:45 – 05:30 và xe rời kho sau khi xếp xong. Chuyến
 * chính `TRIP-2026-0914` được duyệt 09:00 ngày chạy nên đi buổi chiều.
 */
export const SEED_DEPARTURE_TIME = '08:00'
export const HERO_DEPARTURE_TIME = '13:30'
