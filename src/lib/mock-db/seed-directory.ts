import type { CargoPackage } from '@/domain/models'
import type { DeliveryStop } from './types'

/**
 * Danh bạ khách nhận hàng và danh mục hàng dùng để dựng 14 chuyến seed của đợt 6 (LM-083). Tên, địa chỉ tiếng Việt thật
 * quanh TP. Hồ Chí Minh, Bình Dương, Đồng Nai, Long An; số điện thoại dạng hiển thị để nút Gọi của tài xế dùng được (D-46).
 *
 * Hai khách là điểm đến của yêu cầu giao seed (Co.opmart Bình Dương, Bách Hoá Xanh Dĩ An) có toạ độ trùng `LONG_BINH_DESTINATIONS` —
 * để yêu cầu đưa vào chuyến gộp vào đúng điểm giao đang có (FE-4b-04, D-73).
 *
 * **Toạ độ là dữ liệu mẫu gần đúng ở mức khu vực** (FE-4b-09): lấy toạ độ quận / khu công nghiệp của khách trong danh sách địa danh
 * mẫu (`seed-places.ts`), khách cùng một quận lệch nhau vài trăm mét tới vài km để mốc trên bản đồ không trùng — không tới số nhà,
 * không dùng để dẫn đường. Đủ để chuyến seed có tuyến đã tối ưu. Riêng **Điện máy Xanh Tân An chưa có toạ độ**: chuyến nháp `TRIP-014`
 * giữ một điểm thiếu toạ độ để thấy được lỗi `MISSING_STOP_COORDINATES`.
 */
export const CUSTOMERS = {
  thucPhamSaiGon: { name: 'Công ty TNHH Thực phẩm Sài Gòn', address: '12 Nguyễn Văn Linh, Q.7, TP. Hồ Chí Minh', phone: '0283 775 1122', contactName: 'Chị Hương', lat: 10.7295, lng: 106.7218 },
  coopBinhDuong: { name: 'Siêu thị Co.opmart Bình Dương', address: '30 Đại lộ Bình Dương, Thủ Dầu Một', phone: '0274 382 6655', contactName: 'Anh Phúc', lat: 10.979, lng: 106.673 },
  bhxDiAn: { name: 'Kho Bách Hoá Xanh Dĩ An', address: '215 Quốc lộ 1K, P. Đông Hoà, Dĩ An', phone: '0909 318 204', contactName: 'Anh Toàn', lat: 10.896, lng: 106.789 },
  longChauBienHoa: { name: 'Nhà thuốc Long Châu Biên Hoà', address: '58 Võ Thị Sáu, P. Quyết Thắng, Biên Hoà', phone: '0251 382 7719', contactName: 'Chị Ngân', lat: 10.9462, lng: 106.8196 },
  bhxThuDuc: { name: 'Cửa hàng Bách Hoá Xanh Thủ Đức', address: '96 Võ Văn Ngân, P. Bình Thọ, Thủ Đức', phone: '0938 552 109', contactName: 'Chị Thảo', lat: 10.8494, lng: 106.7537 },
  coopBienHoa: { name: 'Siêu thị Co.opmart Biên Hoà', address: '121 Phạm Văn Thuận, P. Tân Tiến, Biên Hoà', phone: '0251 381 4420', contactName: 'Anh Khánh', lat: 10.9574, lng: 106.8427 },
  haiHaTanBinh: { name: 'Bánh kẹo Hải Hà – chi nhánh Tân Bình', address: '45 Cộng Hoà, P. 4, Tân Bình', phone: '0283 811 5530', contactName: 'Anh Quân', lat: 10.8015, lng: 106.6526 },
  huongViet: { name: 'Nhà hàng Hương Việt', address: '203 Lê Văn Sỹ, P. 13, Q.3', phone: '0907 663 118', contactName: 'Chị Linh', lat: 10.7843, lng: 106.6844 },
  megaAnPhu: { name: 'MM Mega Market An Phú', address: '1 Mai Chí Thọ, P. An Phú, Thủ Đức', phone: '0283 740 6677', contactName: 'Anh Hiếu', lat: 10.8012, lng: 106.7412 },
  circleKPhuNhuan: { name: 'Circle K Phan Xích Long', address: '152 Phan Xích Long, P. 7, Phú Nhuận', phone: '0937 214 560', contactName: 'Chị My', lat: 10.7992, lng: 106.68 },
  dienMayLongAn: { name: 'Điện máy Xanh Tân An', address: '88 Hùng Vương, P. 2, Tân An, Long An', phone: '0272 382 9901', contactName: 'Anh Tài' },
  khoLanhTanUyen: { name: 'Kho lạnh ABA Cooltrans Tân Uyên', address: 'Lô C7, KCN Nam Tân Uyên, Bình Dương', phone: '0274 365 2288', contactName: 'Anh Vũ', lat: 11.06, lng: 106.74 },
  bepAnSongThan: { name: 'Bếp ăn công nghiệp KCN Sóng Thần', address: '12 Đường số 6, KCN Sóng Thần 1, Dĩ An', phone: '0918 407 331', contactName: 'Chị Oanh', lat: 10.893, lng: 106.75 },
  lotteQ7: { name: 'Lotte Mart Quận 7', address: '469 Nguyễn Hữu Thọ, P. Tân Hưng, Q.7', phone: '0283 775 3344', contactName: 'Anh Đạt', lat: 10.7411, lng: 106.7019 },
  phuongNamTdm: { name: 'Nhà sách Phương Nam Thủ Dầu Một', address: '52 Bạch Đằng, P. Phú Cường, Thủ Dầu Một', phone: '0274 383 7715', contactName: 'Chị Vy', lat: 10.9804, lng: 106.6519 },
  duocBinhChanh: { name: 'Kho dược Lê Minh Xuân', address: 'Lô 15, KCN Lê Minh Xuân, Bình Chánh', phone: '0283 766 1809', contactName: 'Anh Nghĩa', lat: 10.755, lng: 106.53 },
  vatLieuHoangPhat: { name: 'Vật liệu xây dựng Hoàng Phát', address: '71 Quốc lộ 51, P. Long Bình Tân, Biên Hoà', phone: '0909 882 517', contactName: 'Anh Hoàng', lat: 10.9034, lng: 106.8512 },
  mamNonHoaSen: { name: 'Trường Mầm non Hoa Sen', address: '9 Nguyễn Thị Minh Khai, P. Đa Kao, Q.1', phone: '0283 822 6070', contactName: 'Cô Trang', lat: 10.7879, lng: 106.7003 },
  benhVienDongNai: { name: 'Bệnh viện Đa khoa Đồng Nai – kho vật tư', address: '2 Đồng Khởi, P. Tam Hoà, Biên Hoà', phone: '0251 381 1507', contactName: 'Chị Duyên', lat: 10.9451, lng: 106.8603 },
  phucLongBinhThanh: { name: 'Kho cà phê Phúc Long Bình Thạnh', address: '27 Điện Biên Phủ, P. 15, Bình Thạnh', phone: '0283 512 4436', contactName: 'Anh Kiên', lat: 10.8106, lng: 106.7091 },
} satisfies Record<string, Omit<DeliveryStop, 'id'>>

export type CustomerKey = keyof typeof CUSTOMERS

type CargoTemplate = Omit<CargoPackage, 'id' | 'quantity' | 'deliveryStop'>

/** Mặc định hàng tạp hoá: giữ đứng, xếp chồng được, đỡ tối thiểu 80%, bắt buộc xếp. Mỗi loại ghi đè phần khác. */
function goods(line: Pick<CargoTemplate, 'name' | 'lengthCm' | 'widthCm' | 'heightCm' | 'weightKg' | 'maxTopLoadKg' | 'maxStackCount'> & Partial<CargoTemplate>): CargoTemplate {
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

/** Danh mục hàng; `maxTopLoadKg` mỗi loại chịu được cả cột `maxStackCount` kiện cùng loại. */
export const CARGO = {
  nuocSuoi: goods({ name: 'Thùng nước suối 24 chai', lengthCm: 50, widthCm: 35, heightCm: 25, weightKg: 13, maxTopLoadKg: 60, maxStackCount: 5 }),
  miGoi: goods({ name: 'Thùng mì ăn liền 30 gói', lengthCm: 55, widthCm: 40, heightCm: 30, weightKg: 3.5, maxTopLoadKg: 20, maxStackCount: 5, fragilityLevel: 'LOW' }),
  gao: goods({ name: 'Bao gạo 25 kg', lengthCm: 70, widthCm: 45, heightCm: 15, weightKg: 25, maxTopLoadKg: 150, maxStackCount: 6 }),
  dauAn: goods({ name: 'Thùng dầu ăn 12 chai', lengthCm: 45, widthCm: 32, heightCm: 30, weightKg: 12, maxTopLoadKg: 50, maxStackCount: 4 }),
  nuocGiat: goods({ name: 'Kiện nước giặt 4 can', lengthCm: 50, widthCm: 40, heightCm: 35, weightKg: 16, maxTopLoadKg: 64, maxStackCount: 4 }),
  suaHop: goods({ name: 'Thùng sữa hộp 48 hộp', lengthCm: 60, widthCm: 40, heightCm: 40, weightKg: 52, maxTopLoadKg: 160, maxStackCount: 4, fragilityLevel: 'LOW' }),
  banhQuy: goods({ name: 'Thùng bánh quy', lengthCm: 60, widthCm: 40, heightCm: 35, weightKg: 6, maxTopLoadKg: 18, maxStackCount: 4, fragilityLevel: 'MEDIUM' }),
  vanPhongPham: goods({
    name: 'Kiện văn phòng phẩm', lengthCm: 60, widthCm: 40, heightCm: 30, weightKg: 18, maxTopLoadKg: 72, maxStackCount: 5,
    allowedOrientations: ['LWH', 'LHW', 'WLH', 'WHL', 'HLW', 'HWL'], keepUpright: false,
  }),
  sachGiaoKhoa: goods({ name: 'Thùng sách giáo khoa', lengthCm: 55, widthCm: 40, heightCm: 30, weightKg: 20, maxTopLoadKg: 80, maxStackCount: 5 }),
  quatDien: goods({ name: 'Kiện quạt điện', lengthCm: 45, widthCm: 45, heightCm: 60, weightKg: 9, maxTopLoadKg: 18, maxStackCount: 3, fragilityLevel: 'MEDIUM' }),
  noiComDien: goods({ name: 'Thùng nồi cơm điện', lengthCm: 40, widthCm: 40, heightCm: 35, weightKg: 5, maxTopLoadKg: 15, maxStackCount: 4, fragilityLevel: 'MEDIUM', mustLoad: false }),
  thitDongLanh: goods({ name: 'Thùng thịt đông lạnh', lengthCm: 60, widthCm: 40, heightCm: 30, weightKg: 22, maxTopLoadKg: 88, maxStackCount: 5, priority: 3 }),
  haiSanDongLanh: goods({ name: 'Thùng hải sản đông lạnh', lengthCm: 60, widthCm: 40, heightCm: 25, weightKg: 18, maxTopLoadKg: 72, maxStackCount: 5, priority: 3 }),
  vatTuYTe: goods({
    name: 'Kiện thuốc và vật tư y tế', lengthCm: 80, widthCm: 60, heightCm: 40, weightKg: 60, maxTopLoadKg: 120, maxStackCount: 3,
    allowedOrientations: ['LWH', 'LHW', 'WLH', 'WHL', 'HLW', 'HWL'], keepUpright: false, fragilityLevel: 'LOW', priority: 3,
  }),
  gachOp: goods({ name: 'Thùng gạch ốp tường', lengthCm: 60, widthCm: 30, heightCm: 15, weightKg: 24, maxTopLoadKg: 96, maxStackCount: 5, fragilityLevel: 'MEDIUM' }),
  caPheHat: goods({ name: 'Bao cà phê hạt 20 kg', lengthCm: 60, widthCm: 40, heightCm: 20, weightKg: 20, maxTopLoadKg: 120, maxStackCount: 6 }),
  lyThuyTinh: goods({
    name: 'Thùng ly thuỷ tinh', lengthCm: 40, widthCm: 30, heightCm: 25, weightKg: 13.5, maxTopLoadKg: 30, maxStackCount: 3,
    fragilityLevel: 'HIGH', minSupportRatio: 1, mustLoad: false, notes: 'Hàng dễ vỡ, không đặt dưới kiện nặng',
  }),
} satisfies Record<string, CargoTemplate>

export type CargoKey = keyof typeof CARGO
