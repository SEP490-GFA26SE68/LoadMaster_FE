/**
 * Số liệu vật lý của ràng buộc xếp hàng, chỉ khi nối máy chủ: sức chịu nén mặt trên (σ) ở form loại kiện và form kiện, trợ giúp ước tính
 * σ cho thùng carton (công thức McKee), tải trọng sàn và lệch trọng tâm ngang ở form loại xe, cảnh báo thiếu dữ liệu của lần chạy tối ưu
 * (hộp chạy ở Thiết lập tối ưu và màn So sánh theo lần chạy).
 */
export const physicalData = {
  sigma: {
    label: 'Sức chịu nén mặt trên',
    hint: 'Khối lượng tối đa đè lên mỗi m² mặt trên của kiện. Để trống là chưa có số liệu — không tự lấy giá trị nào.',
    packageLabel: 'Sức chịu nén mặt trên riêng của kiện',
    packageHint: 'Ghi đè giá trị của loại kiện. Để trống là dùng giá trị của loại kiện.',
  },
  mckee: {
    toggle: 'Ước tính cho thùng carton',
    description: 'Tính từ độ bền nén cạnh và độ dày tấm carton; chu vi đáy và diện tích mặt trên lấy từ dài, rộng của loại kiện.',
    ect: 'Độ bền nén cạnh (ECT)',
    ectHint: 'Ví dụ: 32 lb/in ≈ 5.604 N/m.',
    thickness: 'Độ dày tấm carton',
    safetyFactor: 'Hệ số an toàn',
    safetyFactorHint: 'Tính đến độ ẩm, thời gian lưu kho, rung khi chở; thường lớn hơn 2.',
    needDimensions: 'Nhập dài và rộng của loại kiện để tính chu vi đáy và diện tích mặt trên.',
    needInputs: 'Nhập độ bền nén cạnh, độ dày tấm và hệ số an toàn (đều lớn hơn 0) để xem kết quả.',
    perimeter: 'Chu vi đáy',
    area: 'Diện tích mặt trên',
    boxCompression: 'Sức nén của thùng',
    result: 'Sức chịu nén ước tính',
    use: 'Dùng giá trị này',
    formula: 'Sức nén thùng ≈ 5,87 × ECT × √(độ dày × chu vi đáy); sức chịu nén ≈ sức nén thùng ÷ (hệ số an toàn × 9,81 × diện tích mặt trên).',
    limits:
      'Công thức chỉ đúng cho thùng carton một lớp sóng, kiểu thùng nắp gập tiêu chuẩn (RSC), rỗng, đo trong phòng thí nghiệm. Sai số đáng kể với thùng có lỗ, nhiều lớp sóng hoặc chồng lệch.',
  },
  vehicle: {
    floorLoad: 'Tải trọng sàn',
    floorLoadHint: 'Khối lượng tối đa trên mỗi m² sàn thùng. Để trống là không kiểm tải sàn.',
    cogY: 'Lệch trọng tâm ngang tối đa',
    cogYHint: 'Theo % chiều rộng lòng thùng. Để trống là dùng cùng ngưỡng lệch dọc.',
  },
  errors: {
    nonNegative: 'Nhập số từ 0 trở lên.',
    positive: 'Nhập số lớn hơn 0.',
    decimalScale: 'Tối đa hai chữ số sau dấu thập phân.',
    cannotClear: 'Máy chủ chưa xoá được giá trị đã lưu: nhập giá trị mới, hoặc giữ giá trị cũ.',
  },
  warnings: {
    title: 'Dữ liệu kiện còn thiếu',
    TOP_LOAD_CAPACITY_MISSING: {
      one: '{count} kiện chưa có sức chịu nén mặt trên — nhập ở loại kiện hoặc riêng từng kiện.',
      other: '{count} kiện chưa có sức chịu nén mặt trên — nhập ở loại kiện hoặc riêng từng kiện.',
    },
    PACKAGE_TYPE_MISSING: {
      one: '{count} kiện chưa gắn loại kiện nên không được xoay khi xếp.',
      other: '{count} kiện chưa gắn loại kiện nên không được xoay khi xếp.',
    },
    codes: 'Kiện: {codes}',
    more: {
      one: 'và {count} kiện khác',
      other: 'và {count} kiện khác',
    },
    openPackages: 'Mở Kho kiện',
    openPackageTypes: 'Mở Loại kiện',
  },
} as const
