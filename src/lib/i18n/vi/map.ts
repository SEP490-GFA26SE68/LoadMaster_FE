/** Bản đồ tuyến dùng chung (FE-4b-07): `components/map/RouteMap.tsx` — nhãn điểm cho trình đọc màn hình, nút phóng to / thu nhỏ. */
export const map = {
  points: 'Các điểm trên bản đồ, theo thứ tự đi',
  depot: 'Kho xuất phát: {name}',
  stop: 'Điểm {number}: {name}',
  vehicle: 'Vị trí xe: {name}',
  canvas: 'Bản đồ tương tác',
  zoomIn: 'Phóng to',
  zoomOut: 'Thu nhỏ',
  fit: 'Xem toàn tuyến',
  keyboardHint: 'Khi bản đồ đang được chọn: phím + và − để phóng to, thu nhỏ; phím mũi tên để dời bản đồ.',
  attribution: 'Hiện hoặc ẩn nguồn dữ liệu bản đồ',
  /** Lời nhắc của bản đồ khi người dùng lăn chuột / vuốt một ngón qua nó: trang cuộn, bản đồ đứng yên. */
  gestures: {
    ctrl: 'Giữ Ctrl rồi lăn chuột để phóng to bản đồ',
    command: 'Giữ ⌘ rồi lăn chuột để phóng to bản đồ',
    touch: 'Dùng hai ngón tay để dời bản đồ',
  },
  /** Ô chọn toạ độ (FE-4b-03): `components/map/CoordinatePicker.tsx` — tìm địa danh mẫu, hai ô vĩ độ / kinh độ, bản đồ bấm chọn. */
  picker: {
    search: 'Tìm địa danh',
    searchPlaceholder: 'Gõ tên tỉnh, quận hoặc khu công nghiệp',
    results: 'Địa danh khớp',
    noResults: 'Không có địa danh mẫu nào khớp "{query}". Gõ toạ độ vào hai ô bên dưới.',
    kind: { PROVINCE: 'Tỉnh / thành', DISTRICT: 'Quận / huyện', INDUSTRIAL_PARK: 'Khu công nghiệp' },
    lat: 'Vĩ độ',
    lng: 'Kinh độ',
    clear: 'Bỏ toạ độ',
    picked: 'Đã lấy toạ độ của {name}.',
    hint: 'Chọn từ danh sách địa danh mẫu (toạ độ gần đúng ở mức khu vực) hoặc gõ vĩ độ, kinh độ.',
    hintMap: 'Chọn từ danh sách địa danh mẫu, bấm lên bản đồ, hoặc gõ vĩ độ, kinh độ.',
    map: 'Bản đồ chọn toạ độ',
    errors: {
      incomplete: { lat: 'Nhập cả vĩ độ', lng: 'Nhập cả kinh độ' },
      invalid: { lat: 'Vĩ độ là số từ −90 đến 90', lng: 'Kinh độ là số từ −180 đến 180' },
    },
  },
} as const
