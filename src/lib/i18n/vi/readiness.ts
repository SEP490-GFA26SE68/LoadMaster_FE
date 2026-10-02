/**
 * Kiểm tra "Sẵn sàng tối ưu" của chuyến (luồng 2 Review 1, LM-104) — card ở cột phải Chi tiết chuyến: key `checks` trùng
 * `READINESS_CODES` của `@/domain/constraints`. Mỗi mã có nhãn, câu khi đạt và khi chưa đạt; điểm giao và loại hàng có thêm câu cảnh báo. Số
 * truyền vào đã format theo ngôn ngữ.
 */
export const readiness = {
  title: 'Kiểm tra trước khi tối ưu',
  ready: 'Sẵn sàng tối ưu',
  notReady: 'Chưa sẵn sàng tối ưu',
  loading: 'Đang kiểm tra chuyến',
  readyNote: 'Chuyến đủ điều kiện chạy tối ưu. Xếp được hết hay không vẫn do lần tối ưu quyết định.',
  blocked: { one: '{count} mục đang chặn tối ưu. Sửa xong rồi chạy tối ưu.', other: '{count} mục đang chặn tối ưu. Sửa xong rồi chạy tối ưu.' },
  status: { pass: 'Đạt', warn: 'Cảnh báo', fail: 'Chưa đạt' },
  fix: {
    editTrip: 'Sửa chuyến',
    assignRequirement: 'Đưa yêu cầu vào chuyến',
    reviewPackages: 'Xem kiện lỗi',
  },
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
    CARGO_SEGREGATED: {
      label: 'Loại hàng',
      pass: 'Mọi kiện cùng một loại hàng',
      warn: '{packages} kiện khác loại hàng, đã ghi lý do chở chung',
      fail: '{packages} kiện khác loại hàng của chuyến, chưa ghi lý do chở chung',
    },
    WEIGHT_WITHIN_PAYLOAD: { label: 'Khối lượng', pass: '{total} / {payload}', fail: '{total} vượt tải trọng {payload}' },
    VOLUME_WITHIN_CARGO: { label: 'Thể tích', pass: '{total} / {cargo}', fail: '{total} vượt thể tích thùng {cargo}' },
  },
} as const
