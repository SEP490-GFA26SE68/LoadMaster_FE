/**
 * Giám sát chuyến Đang vận chuyển (FE-6-08, FE-6-09): vị trí xe và giờ đến tính từ vị trí. Hiện ở card sơ đồ tuyến của Chi tiết chuyến
 * (`features/monitoring/LiveLocationBar.tsx`); màn Giám sát thêm phần của nó vào nhánh này.
 */
export const monitoring = {
  location: {
    title: 'Vị trí xe',
    /** Nguồn của vị trí (`LocationSource` của kho): nhãn luôn đi kèm mọi chỗ hiện vị trí. */
    sources: { SIMULATED: 'Mô phỏng', GPS: 'GPS' },
    /** Tên mốc xe trên bản đồ cho trình đọc màn hình: tên xe kèm nguồn vị trí. */
    vehicle: '{name} ({source})',
    moving: 'Lúc {time} · đang chạy {speed} km/h',
    standing: 'Lúc {time} · đang dừng',
    basis: 'Giờ đến của các điểm chưa giao tính lại từ vị trí xe sau mỗi điểm vị trí, theo đường nối thẳng giữa các điểm.',
  },
} as const
