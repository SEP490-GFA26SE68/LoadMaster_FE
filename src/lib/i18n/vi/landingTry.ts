/**
 * Mục "Thử với xe của bạn" của trang giới thiệu (\`features/marketing/try\`, neo \`#thu-xe\`): khách nhập lòng thùng xe và một hoặc hai
 * loại kiện, bộ tối ưu mô phỏng chạy ngay trên trình duyệt (không tài khoản, không credit, không máy chủ) rồi vẽ hình đẳng cự SVG.
 */
export const landingTry = {
  title: 'Thử với xe của bạn',
  lede: 'Nhập lòng thùng xe và kiện hàng của bạn rồi bấm Tính thử. Bộ tối ưu mô phỏng của LoadMaster chạy ngay trên trình duyệt này để xếp thử.',
  form: {
    /** Tên truy cập của form. */
    label: 'Số liệu để xếp thử',
    run: 'Tính thử',
    cancel: 'Huỷ',
    privacy: 'Chạy trên trình duyệt này: không cần tài khoản, không tốn credit, không gửi số liệu lên máy chủ.',
  },
  truck: {
    legend: 'Lòng thùng xe',
    presets: 'Xe mẫu',
    /** Nhãn nút xe mẫu: chiều dài thùng (m) và tải trọng (tấn) của chính xe mẫu đó. */
    preset: 'Thùng {length} m · {payload} tấn',
    presetsSource: 'Số của xe mẫu trong ứng dụng: xe "Truck 6m" của bộ dữ liệu mẫu, xe nhỏ nhất và xe lớn nhất của đội xe mẫu.',
    lengthCm: 'Dài (cm)',
    widthCm: 'Rộng (cm)',
    heightCm: 'Cao (cm)',
    payloadKg: 'Tải trọng (kg)',
    note: 'Bản thử coi cửa sau mở hết lòng thùng và không tính hốc bánh xe. Trong ứng dụng, mỗi xe khai đủ cửa, vật cản và trục.',
  },
  cartons: {
    legend: 'Loại kiện {number}',
    /** Nút điền kiện mẫu; phần `presetFor` chỉ cho trình đọc màn hình. */
    preset: 'Dùng {name}',
    presetFor: 'cho loại kiện {number}',
    lengthCm: 'Dài (cm)',
    widthCm: 'Rộng (cm)',
    heightCm: 'Cao (cm)',
    weightKg: 'Nặng mỗi kiện (kg)',
    quantity: 'Số kiện',
    add: 'Thêm loại kiện thứ hai',
    remove: 'Bỏ loại kiện {number}',
    total: 'Tổng {total} / {max} kiện',
    rules: 'Kiện giữ đứng, xoay được quanh trục đứng và xếp chồng được, theo cùng mặc định với kiện thêm lẻ trong ứng dụng.',
  },
  errors: {
    required: 'Nhập một số',
    number: 'Chỉ nhập số, ví dụ 120 hoặc 45,5',
    integer: 'Số kiện là số nguyên',
    range: 'Từ {min} đến {max}',
    totalQuantity: 'Bản thử xếp tối đa {max} kiện mỗi lần',
  },
  result: {
    title: 'Kết quả xếp thử',
    idle: 'Hình trên là lòng thùng theo số đang nhập. Bấm Tính thử để xếp kiện vào.',
    progress: 'Đã xét {placed} / {total} kiện',
    /** Tên của thanh tiến độ. */
    progressLabel: 'Tiến độ xếp thử',
    placed: 'Kiện xếp được',
    placedValue: '{placed} / {total}',
    volume: 'Thể tích dùng',
    weight: 'Khối lượng đã xếp',
    weightOf: 'trên {max}',
    unplacedTitle: 'Kiện chưa xếp',
    unplacedRow: '{kind}: {count} kiện — {reason}',
    allPlaced: 'Xếp được hết mọi kiện.',
    runtime: 'Bộ tối ưu mô phỏng tính trong {ms} ms trên trình duyệt này.',
    source: 'Số của bộ tối ưu mô phỏng. Trong ứng dụng, mỗi lần chạy còn tính vùng điểm giao, tải trục và ra ba phương án để so sánh.',
    stale: 'Số trong form đã đổi sau lần tính này. Bấm Tính thử để tính lại.',
    legend: 'Chú giải màu',
    previewLabel: 'Hình đẳng cự lòng thùng {size}, đã xếp {placed} kiện',
    emptyPreviewLabel: 'Hình đẳng cự lòng thùng {size}, chưa có kiện',
  },
  announce: {
    running: 'Đang xếp thử',
    done: 'Đã tính xong: xếp được {placed} / {total} kiện, dùng {volume} thể tích.',
  },
  failure: {
    invalid: 'Chưa chạy được với bộ số này:',
    failed: 'Bộ tối ưu mô phỏng không xếp được bộ số này.',
    timeout: 'Quá {seconds} giây mà chưa tính xong. Thử ít kiện hơn.',
    service: 'Trình duyệt này không chạy được bộ tối ưu mô phỏng. Thử lại, hoặc mở trang bằng trình duyệt khác.',
    cancelled: 'Đã huỷ lần tính.',
  },
} as const
