/**
 * Địa danh mẫu có toạ độ (FE-4b-03, D-72): tỉnh / thành, quận / huyện / thành phố thuộc tỉnh và khu công nghiệp — nguồn của ô chọn toạ
 * độ khi chưa có backend tìm địa chỉ (Q-20). Dữ liệu tham chiếu dùng chung, không thuộc công ty nào.
 *
 * **Toạ độ là dữ liệu mẫu gần đúng ở mức khu vực** (tâm tỉnh lỵ, tâm quận, cổng khu công nghiệp — sai số tới vài km), chép tay, WGS84 độ
 * thập phân; không dùng để dẫn đường. Bốn khu công nghiệp Hoà Khánh, Phú Bài, Thăng Long, Trà Nóc và KCN Biên Hoà 2 trùng toạ độ với yêu
 * cầu giao và kho xuất phát của seed (`seed-requirements.ts`, `seed-sourcing.ts`).
 */

export const PLACE_KINDS = ['PROVINCE', 'DISTRICT', 'INDUSTRIAL_PARK'] as const
export type PlaceKind = (typeof PLACE_KINDS)[number]

export type Place = {
  /** `PLC-NNN`, theo thứ tự trong danh sách. */
  id: string
  name: string
  kind: PlaceKind
  /** Vùng chứa địa danh, chữ tự do: tỉnh / thành của quận, quận và tỉnh của khu công nghiệp. */
  region: string
  lat: number
  lng: number
}

type Row = readonly [name: string, region: string, lat: number, lng: number]

const PROVINCES: readonly Row[] = [
  ['Hà Nội', 'Đồng bằng sông Hồng', 21.0285, 105.8542],
  ['Hải Phòng', 'Đồng bằng sông Hồng', 20.8449, 106.6881],
  ['Quảng Ninh', 'Đông Bắc Bộ', 20.9712, 107.0448],
  ['Bắc Ninh', 'Đồng bằng sông Hồng', 21.1861, 106.0763],
  ['Thanh Hoá', 'Bắc Trung Bộ', 19.8067, 105.7852],
  ['Nghệ An', 'Bắc Trung Bộ', 18.6796, 105.6813],
  ['Thừa Thiên Huế', 'Bắc Trung Bộ', 16.4637, 107.5909],
  ['Đà Nẵng', 'Nam Trung Bộ', 16.0544, 108.2022],
  ['Quảng Nam', 'Nam Trung Bộ', 15.5736, 108.474],
  ['Bình Định', 'Nam Trung Bộ', 13.783, 109.2197],
  ['Khánh Hoà', 'Nam Trung Bộ', 12.2388, 109.1967],
  ['Đắk Lắk', 'Tây Nguyên', 12.6667, 108.05],
  ['Lâm Đồng', 'Tây Nguyên', 11.9404, 108.4583],
  ['Bình Thuận', 'Nam Trung Bộ', 10.9333, 108.1],
  ['TP. Hồ Chí Minh', 'Đông Nam Bộ', 10.7769, 106.7009],
  ['Bình Dương', 'Đông Nam Bộ', 10.9804, 106.6519],
  ['Đồng Nai', 'Đông Nam Bộ', 10.9574, 106.8427],
  ['Bà Rịa – Vũng Tàu', 'Đông Nam Bộ', 10.346, 107.0843],
  ['Tây Ninh', 'Đông Nam Bộ', 11.31, 106.0983],
  ['Long An', 'Đồng bằng sông Cửu Long', 10.5359, 106.4137],
  ['Tiền Giang', 'Đồng bằng sông Cửu Long', 10.36, 106.36],
  ['Cần Thơ', 'Đồng bằng sông Cửu Long', 10.0452, 105.7469],
  ['An Giang', 'Đồng bằng sông Cửu Long', 10.3864, 105.4352],
  ['Kiên Giang', 'Đồng bằng sông Cửu Long', 10.0125, 105.0809],
  ['Cà Mau', 'Đồng bằng sông Cửu Long', 9.1769, 105.1524],
]

const DISTRICTS: readonly Row[] = [
  ['Quận 1', 'TP. Hồ Chí Minh', 10.7757, 106.7004],
  ['Quận 3', 'TP. Hồ Chí Minh', 10.7843, 106.6844],
  ['Quận 7', 'TP. Hồ Chí Minh', 10.734, 106.7216],
  ['Bình Thạnh', 'TP. Hồ Chí Minh', 10.8106, 106.7091],
  ['Phú Nhuận', 'TP. Hồ Chí Minh', 10.7992, 106.68],
  ['Tân Bình', 'TP. Hồ Chí Minh', 10.8015, 106.6526],
  ['Bình Chánh', 'TP. Hồ Chí Minh', 10.6874, 106.5939],
  ['Thủ Đức', 'TP. Hồ Chí Minh', 10.8494, 106.7537],
  ['Thủ Dầu Một', 'Bình Dương', 10.9804, 106.6519],
  ['Dĩ An', 'Bình Dương', 10.9068, 106.7694],
  ['Thuận An', 'Bình Dương', 10.9053, 106.699],
  ['Tân Uyên', 'Bình Dương', 11.0508, 106.7639],
  ['Bến Cát', 'Bình Dương', 11.15, 106.6],
  ['Biên Hoà', 'Đồng Nai', 10.9574, 106.8427],
  ['Long Thành', 'Đồng Nai', 10.7812, 106.95],
  ['Nhơn Trạch', 'Đồng Nai', 10.7, 106.8833],
  ['Tân An', 'Long An', 10.5359, 106.4137],
  ['Liên Chiểu', 'Đà Nẵng', 16.0717, 108.15],
  ['Hương Thuỷ', 'Thừa Thiên Huế', 16.4, 107.6833],
  ['Vinh', 'Nghệ An', 18.6796, 105.6813],
  ['Đông Anh', 'Hà Nội', 21.1367, 105.848],
  ['Bình Thuỷ', 'Cần Thơ', 10.07, 105.74],
]

const INDUSTRIAL_PARKS: readonly Row[] = [
  ['KCN Biên Hoà 2', 'TP. Biên Hoà, Đồng Nai', 10.9294, 106.8747],
  ['KCN Amata', 'TP. Biên Hoà, Đồng Nai', 10.945, 106.875],
  ['KCN Long Thành', 'H. Long Thành, Đồng Nai', 10.8, 106.95],
  ['KCN Nhơn Trạch 3', 'H. Nhơn Trạch, Đồng Nai', 10.72, 106.93],
  ['KCN Sóng Thần 1', 'TP. Dĩ An, Bình Dương', 10.893, 106.75],
  ['KCN Sóng Thần 2', 'TP. Dĩ An, Bình Dương', 10.9, 106.743],
  ['KCN VSIP 1', 'TP. Thuận An, Bình Dương', 10.928, 106.712],
  ['KCN Mỹ Phước 3', 'TX. Bến Cát, Bình Dương', 11.11, 106.61],
  ['KCN Nam Tân Uyên', 'TX. Tân Uyên, Bình Dương', 11.06, 106.74],
  ['KCN Tân Bình', 'Q. Tân Phú, TP. Hồ Chí Minh', 10.817, 106.62],
  ['KCN Tân Tạo', 'Q. Bình Tân, TP. Hồ Chí Minh', 10.745, 106.59],
  ['KCN Lê Minh Xuân', 'H. Bình Chánh, TP. Hồ Chí Minh', 10.755, 106.53],
  ['KCN Hiệp Phước', 'H. Nhà Bè, TP. Hồ Chí Minh', 10.64, 106.75],
  ['Khu công nghệ cao TP. Hồ Chí Minh', 'TP. Thủ Đức, TP. Hồ Chí Minh', 10.842, 106.809],
  ['KCN Long Hậu', 'H. Cần Giuộc, Long An', 10.633, 106.72],
  ['KCN Mỹ Xuân A', 'TX. Phú Mỹ, Bà Rịa – Vũng Tàu', 10.63, 107.05],
  ['KCN Trà Nóc', 'Q. Bình Thuỷ, Cần Thơ', 10.1028, 105.7103],
  ['KCN Hoà Khánh', 'Q. Liên Chiểu, Đà Nẵng', 16.0747, 108.1506],
  ['KCN Phú Bài', 'TX. Hương Thuỷ, Thừa Thiên Huế', 16.4022, 107.696],
  ['KCN Bắc Vinh', 'TP. Vinh, Nghệ An', 18.71, 105.67],
  ['KCN Thăng Long', 'H. Đông Anh, Hà Nội', 21.1186, 105.7797],
  ['KCN VSIP Bắc Ninh', 'TP. Từ Sơn, Bắc Ninh', 21.11, 105.99],
  ['KCN Đình Vũ', 'Q. Hải An, Hải Phòng', 20.83, 106.76],
]

const GROUPS: readonly (readonly [PlaceKind, readonly Row[]])[] = [['PROVINCE', PROVINCES], ['DISTRICT', DISTRICTS], ['INDUSTRIAL_PARK', INDUSTRIAL_PARKS]]

/** 70 địa danh: 25 tỉnh / thành, 22 quận / huyện, 23 khu công nghiệp — theo thứ tự đó. */
export const SEED_PLACES: readonly Place[] = GROUPS.flatMap(([kind, rows]) => rows.map(([name, region, lat, lng]) => ({ name, kind, region, lat, lng })))
  .map((place, index) => ({ id: `PLC-${String(index + 1).padStart(3, '0')}`, ...place }))
