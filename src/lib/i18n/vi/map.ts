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
} as const
