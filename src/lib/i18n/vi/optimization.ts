/** Thiết lập tối ưu và chạy job (LM-047, LM-048). */
export const optimization = {
  title: 'Thiết lập tối ưu',
  back: 'Quay lại chuyến',
  run: 'Tối ưu',
  vehicle: 'Xe chở chuyến này',
  editVehicle: 'Sửa cấu hình xe',
  editPackages: 'Sửa kiện',
  /** Phần đánh số của form (V2) và panel "Hai giới hạn" bên phải. */
  inputTitle: 'Kiểm tra đầu vào',
  stats: { packages: 'Kiện hàng', packagesUnit: '/ {lines} dòng', weight: 'Khối lượng', stops: 'Điểm giao', route: '{first} → {last}' },
  /** Ô thông số của xe đang chọn (V2.3, LM-106). */
  readout: { space: 'Lòng thùng', payload: 'Tải tối đa', door: 'Cửa', obstacles: 'Vật cản' },
  requirementsTitle: 'Yêu cầu xếp hàng',
  requirementsHint: 'Chọn yêu cầu cho lần chạy này.',
  lifoHint: 'Kiện của điểm giao đến trước nằm gần cửa hơn để lấy ra trước.',
  lowCenterHint: 'Tâm khối lượng của hàng đã xếp, không phải của cả xe.',
  advancedTitle: 'Thiết lập nâng cao',
  advancedHint: 'Thuật toán, thời gian giới hạn và random seed.',
  /** Ba phương án ứng viên mỗi lần chạy (FE-5b-05, D-77): một dòng giải thích cho từng mục tiêu; tên nằm ở nhánh `runs`. */
  candidatesTitle: 'Ba phương án mỗi lần chạy',
  candidatesHint: 'Một lần chạy tạo đủ ba phương án để so sánh rồi chọn một bản duyệt.',
  candidateLabel: 'Phương án {label}',
  objectiveHints: {
    MAX_VOLUME: 'Dồn hàng sát vách trong, dùng ít chiều dài thùng nhất.',
    AXLE_BALANCE: 'Đặt khối hàng sao cho hai nhóm trục cùng mức tải.',
    MIN_REHANDLING: 'Xếp theo vùng của từng điểm giao, ít phải dỡ ra xếp lại nhất.',
  },
  /** Thuật toán không chọn tay: mock chạy cùng một thuật toán cho cả ba phương án. */
  algorithmNote: 'Cả ba phương án chạy cùng thuật toán này. Bản demo: phương án do bộ tối ưu mô phỏng tạo và mang nhãn MOCK RESULT.',
  history: {
    description: 'Mọi lần chạy của chuyến, kể cả lần không ra kết quả.',
  },
  /**
   * Credit và hạng thuật toán của gói (FE-8-05, D-89): dòng "Lần chạy này dùng N credit · còn M", trạng thái chặn trước khi bấm Tối ưu
   * (câu cho điều phối viên và cho quản trị công ty khác nhau) và tên hạng thuật toán. Tên hạng là từ vựng thuật toán — chỉ ở màn
   * này; mock chạy EP + DBLF (mock) cho mọi hạng nên màn nói rõ.
   */
  /** Giữ kiện đã ghim khi chạy lại (FE-BL-02). */
  pins: {
    title: 'Giữ kiện đã ghim',
    switch: { one: 'Giữ nguyên chỗ {count} kiện đã ghim', other: 'Giữ nguyên chỗ {count} kiện đã ghim' },
    on: {
      plan: 'Phương án {revision} có {count} kiện đã ghim. Lần chạy này giữ đúng vị trí và hướng của chúng, mock chỉ xếp các kiện còn lại quanh chúng. Vẫn ba phương án A · B · C, vẫn một credit.',
      loaded: 'Kho đã xếp {count} kiện lên xe trước khi gặp kiện hỏng. Lần chạy này giữ nguyên chỗ và hướng của chúng, chỉ xếp các kiện còn lại quanh chúng — không phải dỡ chúng ra. Vẫn ba phương án A · B · C, vẫn một credit.',
    },
    off: 'Chạy bình thường: mọi kiện được xếp lại từ đầu.',
    blocked: {
      one: 'Không giữ được kiện đã xếp {packages}: nó tựa lên kiện hỏng. Chạy bình thường — kho dỡ ra xếp lại theo phương án mới.',
      other: 'Không giữ được {count} kiện đã xếp ({packages}): chúng tựa lên kiện hỏng. Chạy bình thường — kho dỡ ra xếp lại theo phương án mới.',
    },
    invalid: { one: 'Kiện đã ghim không đứng vững ({count} lỗi). Tắt giữ ghim để chạy bình thường.', other: 'Kiện đã ghim không đứng vững ({count} lỗi). Tắt giữ ghim để chạy bình thường.' },
    blockedReason: 'Kiện đã ghim chưa giữ được: tắt giữ ghim để chạy bình thường.',
  },
  credit: {
    title: 'Credit',
    usage: { one: 'Lần chạy này dùng {count} credit · còn {left}', other: 'Lần chạy này dùng {count} credit · còn {left}' },
    usageUnlimited: 'Lần chạy này dùng 0 credit · Không giới hạn',
    tier: 'Hạng thuật toán của gói {plan}',
    tiers: { EP_DBLF: 'EP + DBLF', EP_DBLF_GA: 'EP + DBLF + GA/SA', EP_DBLF_GA_AI: 'EP + DBLF + GA/SA' },
    aiOptimizer: 'AI Optimizer — chưa có',
    tierNote: 'Bản demo chạy EP + DBLF (mock) cho mọi hạng.',
    noPlan: 'Công ty chưa có gói cước.',
    /** Chỉ điều phối viên mở được màn này (`optimization.run`); quản trị công ty nạp credit ở màn gói cước. */
    blocked: {
      INSUFFICIENT_CREDITS: 'Hết credit — liên hệ quản trị công ty',
      SUBSCRIPTION_EXPIRED: 'Gói cước đã hết hạn — liên hệ quản trị công ty',
    },
  },
  limits: {
    eyebrow: 'Trước khi xếp',
    title: 'Hai giới hạn khác nhau',
    weight: 'Khối lượng / tải xe',
    volume: 'Thể tích hàng / thùng',
    detail: '{value} / {capacity}',
    note: 'Thể tích còn trống không bảo đảm mọi kiện đều xếp vừa — kết quả hình học mới quyết định.',
    over: 'vượt {value}',
  },
  afterTitle: 'Sau khi chạy',
  /** Ba bước "Sau khi chạy" (V2.3): bước cuối là điều phối viên duyệt trong Planner (FE-0-07). */
  afterSteps: {
    view: 'So sánh ba phương án, mở một bản trong Planner',
    check: 'Kiểm tra kiện chưa xếp và cảnh báo',
    approve: 'Duyệt để kho thực hiện',
  },
  method: 'Phương pháp',
  methods: {
    MOCK: 'Mock (xếp kệ tất định)',
    EP_DBLF: 'EP-DBLF',
    GA: 'Giải thuật di truyền (GA)',
    SA: 'Luyện kim mô phỏng (SA)',
    BBMP_DCS_PQNET: 'BBMP-DCS-PQNet',
  },
  timeLimit: 'Thời gian giới hạn',
  randomSeed: 'Random seed',
  timeUnit: 'giây',
  timeLimitHint: 'Số giây nguyên từ 1 đến 600.',
  seedHint: 'Số nguyên không âm; cùng seed, cùng kết quả.',
  enforceLifo: 'Bắt buộc thứ tự dỡ theo điểm giao (LIFO)',
  lowCenterOfGravity: 'Ưu tiên trọng tâm thấp',
  timeLimitRange: 'Nhập số giây nguyên từ 1 đến 600.',
  seedInteger: 'Nhập số nguyên không âm.',
  summaryTitle: 'Kiểm tra trước khi tối ưu',
  summaryClear: 'Không có lỗi — có thể tối ưu.',
  groups: { route: 'Tuyến', vehicle: 'Xe', packages: 'Kiện', payload: 'Tải trọng' },
  blocked: 'Còn lỗi: sửa các mục đánh dấu đỏ để tối ưu.',
  /** Lý do nút Tối ưu tắt, ngay trên nút ở dải trời (V2.3 `ThietLapToiUuLoi.jpg`); `places` là tên các nhóm có lỗi. */
  blockedHint: {
    one: 'Chưa chạy được: {count} lỗi cần sửa ở {places}.',
    other: 'Chưa chạy được: {count} lỗi cần sửa ở {places}.',
  },
  /** Danh sách kiểm tra trực tiếp (V2.3, LM-106): mục đạt kèm số của chuyến, mục lỗi kèm nhãn Lỗi / Cảnh báo. */
  check: {
    warnings: 'Có cảnh báo — vẫn tối ưu được.',
    /** Xếp 3D theo tuyến (FE-5b-05): chỉ chạy khi chuyến Đã lập kế hoạch. */
    route: 'Chuyến đã tối ưu tuyến',
    routeDetail: { one: '{count} điểm giao theo thứ tự đã chốt', other: '{count} điểm giao theo thứ tự đã chốt' },
    routeMissing: 'Chuyến còn Nháp. Tối ưu tuyến ở Chi tiết chuyến để chốt thứ tự điểm giao trước khi xếp hàng.',
    routeFix: 'Tới Chi tiết chuyến',
    vehicle: 'Lòng thùng, cửa và vật cản hợp lệ',
    vehicleDetail: '{vehicle} · cửa {door} không lớn hơn lòng thùng',
    dimensions: 'Kích thước và hướng đặt hợp lệ',
    dimensionsDetail: '{lines} dòng kiện · {count} kiện, không trùng mã',
    door: 'Mọi kiện lọt qua cửa sau',
    doorDetail: 'Kiện lớn nhất: {name} {size}',
    optional: {
      one: '{count} kiện không bắt buộc xếp',
      other: '{count} kiện không bắt buộc xếp',
    },
    optionalMore: 'và {count} dòng khác',
    viewPackage: 'Xem kiện',
    payload: 'Trong tải trọng xe',
    payloadDetail: '{total} / {max} · riêng kiện bắt buộc {mustLoad}',
    changeVehicle: 'Đổi xe',
    error: 'Lỗi',
    warning: 'Cảnh báo',
  },
  running: {
    title: 'Đang tối ưu phương án xếp hàng',
    progress: 'Đã xong {done} / {count} phương án',
    /** Tiến trình của từng phương án: số kiện đã xét trong lượt xếp của mục tiêu đó. */
    planProgress: 'Đã xét {placed} / {total} kiện',
    planWaiting: 'Chờ',
    elapsed: 'Đã chạy {seconds} giây',
    cancel: 'Huỷ',
    note: 'Huỷ thì không tạo phương án nào.',
    limit: 'Thời gian giới hạn {seconds} giây',
    trip: 'Chuyến',
    choice: 'Thiết lập',
    choiceValue: '{algorithm} · random seed {seed}',
    requirements: 'Yêu cầu',
    requirementsValue: 'LIFO {lifo} · trọng tâm thấp {lowCenter}',
    on: 'bật',
    off: 'tắt',
    cancelled: 'Đã huỷ tối ưu; không tạo phương án mới.',
  },
  error: {
    title: 'Không chạy được tối ưu',
    SERVICE_UNAVAILABLE: 'Dịch vụ tối ưu không phản hồi. Thử lại sau ít phút.',
    TIME_LIMIT_EXCEEDED: 'Quá thời gian giới hạn mà chưa có kết quả. Tăng thời gian giới hạn rồi thử lại.',
    MOCK_FAILED: 'Bộ tối ưu gặp lỗi khi xếp. Thử lại.',
    WORKER_CRASHED: 'Tiến trình tối ưu bị dừng đột ngột. Thử lại.',
    failedTitle: 'Dữ liệu đầu vào không hợp lệ',
    failedDescription: 'Dịch vụ từ chối yêu cầu. Sửa các lỗi dưới đây rồi tối ưu lại.',
    retry: 'Thử lại',
    close: 'Đóng',
    dismiss: 'Đóng hộp thoại',
  },
  partial: {
    one: 'Kết quả một phần: {count} kiện chưa xếp.',
    other: 'Kết quả một phần: {count} kiện chưa xếp.',
  },
  done: 'Đã tối ưu xong ba phương án; đang mở màn so sánh.',
} as const
