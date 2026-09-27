/**
 * Kiểm tra "Sẵn sàng tối ưu" của chuyến (luồng 2 Review 1, LM-104): key trùng `READINESS_CODES` của `@/domain/constraints`. Mỗi mã có
 * nhãn, câu khi đạt và khi chưa đạt; riêng điểm giao có thêm câu cảnh báo. Số truyền vào đã format theo ngôn ngữ.
 */
export const readiness = {
  title: 'Sẵn sàng tối ưu',
  ready: 'Sẵn sàng tối ưu',
  notReady: 'Chưa sẵn sàng tối ưu',
  checks: {
    VEHICLE_ASSIGNED: { label: 'Xe', pass: 'Đã chọn xe', fail: 'Chưa chọn xe, hoặc xe đang bảo dưỡng' },
    PACKAGES_PRESENT: { label: 'Kiện hàng', pass: '{count} kiện', fail: 'Chưa có kiện nào' },
    PACKAGES_VALID: { label: 'Dữ liệu kiện', pass: 'Mọi kiện hợp lệ', fail: '{invalid} dòng kiện chưa hợp lệ' },
    STOPS_VALID: {
      label: 'Điểm giao',
      pass: '{stops} điểm giao, kiện đều gán đúng điểm',
      warn: '{empty} điểm giao chưa có kiện',
      fail: 'Chưa có điểm giao, hoặc {outside} dòng kiện gán điểm giao không có',
    },
    WEIGHT_WITHIN_PAYLOAD: { label: 'Khối lượng', pass: '{total} / {payload}', fail: '{total} vượt tải trọng {payload}' },
    VOLUME_WITHIN_CARGO: { label: 'Thể tích', pass: '{total} / {cargo}', fail: '{total} vượt thể tích thùng {cargo}' },
  },
} as const
