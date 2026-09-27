/**
 * Hai trang tài liệu bàn giao `/kieu-dang` và `/thanh-phan` theo V2.3 "Cyan kính" (`design/v2.3/screens/web/Main.jpg`,
 * `ThanhPhan.jpg`): khung dải trời, tiêu đề thẻ, ghi chú và nhãn mô tả. Nội dung mẫu (tên chuyến, xe, số đo) lấy từ kho, câu mẫu của
 * thành phần dùng lại nhánh của chính màn đó (`trips`, `viewer`, `admin`…) — ở đây chỉ còn chữ riêng của hai trang tài liệu.
 */
export const designSystem = {
  /** Dải trời chung của hai trang (`SheetLayout`). */
  frame: {
    system: 'Hệ thống',
    breadcrumb: 'Vị trí trang',
  },
  /** `/kieu-dang` — Main.jpg. */
  style: {
    title: 'Cyan kính',
    lede:
      'Hệ thiết kế V2.3 cho LoadMaster. Dải "trời" màu dầu đậm ở đầu mọi màn, kính chỉ nằm trên dải đó và trên cảnh 3D. Phần làm việc là giấy trắng, chữ đậm, màu chỉ dùng khi có nghĩa: cyan là thương hiệu và "sẵn sàng", hổ phách là "cần bạn", xanh lam là "đang chạy".',
    glass: {
      yesTitle: 'Có kính',
      yes: 'Thanh điều hướng · ô số liệu trên dải đầu trang · panel nổi, thanh công cụ và timeline trên cảnh 3D · hộp tìm nhanh Ctrl K',
      noTitle: 'Không kính',
      no: 'Bảng, form, thẻ nội dung, hộp thoại · màn kho và tài xế (ngoài trời, nắng): nền đặc, tương phản cao',
    },
    cyan: {
      title: 'Cyan thương hiệu',
      meta: 'OKLCH hue 200–224 · 11 bậc',
      notes: { primaryFill: 'nút chính, phát sáng', link: 'link, chữ nhấn', sky: 'dải trời, nền 3D' },
    },
    neutral: {
      title: 'Xám ánh cyan',
      meta: 'thay hai thang xám đang song song (--text-* và --ink-*)',
      notes: { app: 'nền app', border: 'viền', secondary: 'chữ phụ', text: 'chữ chính' },
    },
    /** Hex đọc từ CSS lúc chạy; không đọc được (máy không có CSS) thì hiện dấu này. */
    unread: '—',
    lifecycle: {
      title: 'Trạng thái theo vòng đời',
      meta: 'đúng 10 giá trị trong app · màu kể giai đoạn',
      notes: {
        nhap: 'Chưa có phương án',
        dang_toi_uu: 'Chỉ hiện khi đang chạy',
        da_toi_uu: 'Chờ điều phối viên duyệt',
        can_xem_lai: 'Phương án lỗi thời',
        da_duyet: 'Sẵn sàng cho kho',
        dang_xep_hang: 'Kho đang xếp',
        da_xep_xong: 'Chờ tài xế xuất phát',
        dang_giao: 'Tài xế đang giao',
        hoan_thanh: 'Xong',
        da_huy: 'Luôn kèm lý do huỷ',
      },
      legend: 'Chấm đặc = trạng thái · vòng rỗng = chờ người kế tiếp · có quầng = đang chạy.',
      vehicles: 'xe',
      accounts: 'tài khoản',
      stops: 'Điểm giao giữ bảng Okabe–Ito (an toàn mù màu), luôn kèm số:',
    },
    contrast: {
      title: 'Tương phản đã kiểm',
      meta: 'WCAG 2.x · tính lúc mở trang từ token · cần ≥ 4,5 cho chữ thường',
      pair: 'Cặp màu',
      ratio: 'Tỷ lệ',
      rows: {
        onPrimary: 'Chữ dầu trên nút cyan (nút chính)',
        link: 'Link / chữ nhấn cyan-700 trên trắng',
        textSecondary: 'Chữ phụ n-600 trên trắng',
        badgeCyan: 'Badge "Đã duyệt" cyan-800 trên cyan-50',
        badgeWarning: 'Badge "Cần xem lại" amber-700 trên amber-50',
        badgeAzure: 'Badge "Đang giao" azure-700 trên azure-50',
        badgeSuccess: 'Badge "Hoàn thành" green-700 trên green-50',
        skyText: 'Chữ cyan-200 trên đáy dải trời',
        onDanger: 'Chữ trắng trên nút nguy hiểm red-700',
        control: 'Ô chọn / công tắc bật cyan-700 trên trắng (cần ≥ 3)',
        fieldBorder: 'Viền ô nhập --line-strong trên trắng (cần ≥ 3)',
        stops: 'Chữ trên mốc điểm giao 3 · 6 · 7',
        forbidden: 'Chữ trắng trên nút cyan — cấm dùng',
      },
      pass: 'đạt',
      fail: 'không đạt',
    },
    type: {
      title: 'Chữ',
      meta: 'Archivo cho tiêu đề và số lớn · Be Vietnam Pro cho chữ · JetBrains Mono cho mã và số đo',
      screenTitle: { name: 'Tiêu đề màn', spec: 'Archivo 700 · rộng 112% · 32/40' },
      bigNumber: { name: 'Số lớn', spec: 'Archivo 700 · 112% · tnum' },
      cardTitle: { name: 'Tiêu đề thẻ', spec: 'Archivo 650 · 106% · 16/22' },
      body: { name: 'Chữ thường', spec: 'Be Vietnam Pro 400 · 14/20' },
      tableNumber: { name: 'Số trong bảng', spec: 'JetBrains Mono · tnum' },
      code: { name: 'Mã', spec: 'JetBrains Mono 12' },
    },
    components: {
      title: 'Thành phần',
      search: 'Tìm mã chuyến, tuyến, xe',
      ghost: 'Xem thêm',
    },
  },
  /** `/thanh-phan` — ThanhPhan.jpg. */
  components: {
    title: 'Thành phần',
    lede: 'Dùng chung cho mọi màn điều phối và quản trị. Màn kho và tài xế dùng cùng token, cỡ chữ và vùng chạm lớn hơn.',
    /** Bản xem trước không bấm được (nút, hộp thoại, toast, menu): tên nhóm cho trình đọc màn hình. */
    preview: 'Bản xem trước: {name}',
    optional: '(không bắt buộc)',
    buttons: {
      title: 'Nút',
      meta: 'một nút chính mỗi màn · chữ dầu trên cyan',
      small: 'Nhỏ',
      more: 'Thêm thao tác',
      disabledNote: 'Vô hiệu hoá: nền xám, không gradient; lý do nằm ở chú thích nổi.',
    },
    choices: {
      title: 'Chọn và bật tắt',
      vehicleChip: 'Xe: {name}',
      simulation: 'Chế độ mô phỏng',
      periodNote: 'Kỳ báo cáo đổi luôn hai ô số liệu kính bên dưới.',
    },
    tabs: {
      title: 'Tab',
      meta: 'trên dải trời và trên nền trắng',
      groups: 'Nhóm chuyến',
      all: 'Tất cả',
      review: 'Cần xử lý',
      active: 'Đang thực hiện',
      completed: 'Hoàn thành',
      inspector: 'Thông tin phương án',
    },
    banners: { title: 'Thông báo trong trang' },
    fields: {
      title: 'Ô nhập',
      meta: 'nhãn luôn nằm trên · viền 3:1',
      notesPlaceholder: 'Ví dụ: gọi trước khi tới điểm giao',
    },
    labels: {
      title: 'Nhãn, vai trò, người',
      versions: 'Nhãn phiên bản phương án',
      roles: 'Vai trò: một kiểu trung tính, không dùng màu trạng thái',
      people: 'Chữ tắt · mã',
    },
    meters: {
      title: 'Thước đo',
      payloadValue: '{percent} · {used} / {max}',
      heaviest: 'Chuyến dùng tải trọng cao nhất ({id}). Trên 90% thanh chuyển hổ phách, vượt tải trọng xe thì đỏ.',
      waiting: 'đang chờ',
      stepsLabel: 'Tiến trình chuyến {id}',
    },
    table: {
      title: 'Bảng',
      meta: 'đầu cột dính · số canh phải · dòng chọn có vạch cyan · bấm một dòng để chọn',
      trip: '{id} · {stops}',
    },
    kpi: { title: 'Ô số liệu kính', meta: 'chỉ trên dải của Bảng điều khiển' },
    toast: { title: 'Toast', meta: 'góc trên phải, dưới thanh trên' },
    formSection: { title: 'Mục trong form · chú thích nổi' },
    dialog: { title: 'Hộp thoại', meta: 'nền tối 50%, không làm mờ' },
    empty: { title: 'Trống và đang tải', loading: 'Bảng đang tải' },
    menu: {
      title: 'Menu thao tác',
      help: 'Thao tác bị chặn vẫn hiện, mờ, kèm lý do ngay trên dòng.',
    },
  },
} as const
