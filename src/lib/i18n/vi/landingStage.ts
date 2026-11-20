/**
 * Khung 3D chuyến mẫu của trang giới thiệu: chữ thêm cho lúc xe rời kho, tới điểm 1 và dỡ hàng (thẻ chuyến, thẻ chuyển cảnh, mô tả của
 * khung), bộ chọn ba phương án A · B · C và hàng số của điểm 1 trong dải số.
 */
export const landingStage = {
  title: 'Khung 3D chuyến mẫu',
  /** Nhãn dưới chip Đang vận chuyển của thẻ chuyến: xe đã lăn bánh · tới điểm giao · đang dỡ · đã giao điểm đó. */
  departed: 'Đã rời kho',
  arrived: 'Tới điểm {number}',
  unloading: 'Đang dỡ {done} / {total} ở điểm {number}',
  delivered: 'Đã giao điểm {number}',
  /** Thẻ giữa khung lúc khung tối dần để chuyển cảnh tới điểm giao (chỉ là hình: thẻ chuyến đã nói điều này). */
  arrival: 'Tới điểm {number} · {name}',
  /** Câu nối sau mô tả của khung (`landing.stage.caption`); giảm chuyển động thì không có các pha này nên không đọc câu này. */
  caption: 'Xếp xong, cửa thùng đóng lại, xe lăn bánh tới điểm 1 và chỉ dỡ hàng của điểm đó, đúng thứ tự dỡ của phương án.',
  /** Bộ chọn ba phương án của một lần chạy: hiện từ lúc bộ tối ưu tính xong. */
  plans: {
    title: 'Một lần chạy, ba phương án',
    note: 'Cùng {count} kiện, ba mục tiêu. Chọn một phương án để xem xe được xếp lại theo nó.',
    pending: 'Ba phương án hiện ra khi bộ tối ưu tính xong.',
    name: 'Phương án {label} — {objective}',
    best: 'Tốt nhất',
    volume: 'Lấp đầy',
    axleGap: 'Chênh tải hai trục',
    axleGapValue: '{value} điểm %',
    rehandling: 'Dỡ-xếp lại',
    unplaced: 'Chưa xếp',
  },
  /** Hàng số của điểm 1 trong dải số: mọi số đếm trên phương án đang xem. */
  stop: {
    title: 'Ở điểm {number} · {name}',
    count: 'Kiện của điểm',
    moved: 'Phải dời để lấy ra',
    foreign: 'Kiện điểm khác trong vùng',
    stray: 'Kiện của điểm nằm ngoài vùng',
  },
} as const
