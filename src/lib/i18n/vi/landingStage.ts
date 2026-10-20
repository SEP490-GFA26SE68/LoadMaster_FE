/** Khung 3D chuyến mẫu của trang giới thiệu: chữ thêm cho lúc xe rời kho (thẻ chuyến, mô tả của khung). */
export const landingStage = {
  title: 'Khung 3D chuyến mẫu',
  /** Nhãn dưới chip Đang vận chuyển của thẻ chuyến khi xe đã lăn bánh. */
  departed: 'Đã rời kho',
  /** Câu nối sau mô tả của khung (`landing.stage.caption`); giảm chuyển động thì không có pha này nên không đọc câu này. */
  caption: 'Xếp xong, cửa thùng đóng lại và xe lăn bánh rời kho.',
} as const
