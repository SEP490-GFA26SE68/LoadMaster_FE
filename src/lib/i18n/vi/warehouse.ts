/**
 * Màn kho `/kho` (LM-060, LM-086): danh sách chuyến cần xếp, bước Soạn hàng (FE-6-02) rồi bước Xếp có đối chiếu từng kiện (FE-6-05)
 * theo revision đã duyệt, tiến độ ghi vào kho, màn xếp xong. Số cm theo locale.
 */
export const warehouse = {
  loading: 'Đang tải chuyến',
  starting: 'Đang bắt đầu soạn hàng',
  exit: 'Thoát màn kho',
  backToList: 'Về danh sách chuyến',
  retry: 'Thử lại',
  loadErrorTitle: 'Không tải được chuyến',
  startErrorTitle: 'Chưa bắt đầu soạn hàng được',
  emptyTitle: 'Chưa có phương án đã duyệt',
  emptyTripDescription: 'Chuyến {tripId} chưa có phương án đã duyệt. Điều phối viên cần duyệt phương án trước khi kho xếp.',
  staleTitle: 'Chờ tối ưu và duyệt lại',
  staleDescription: 'Phương án đã duyệt của chuyến {tripId} lỗi thời: xe hoặc kiện đã đổi sau lần tối ưu. Kho chỉ xếp được khi điều phối viên tối ưu lại và duyệt.',
  cancelledTitle: 'Chuyến đã huỷ',
  cancelledDescription: 'Chuyến {tripId} đã huỷ: {reason}',
  /** Chuyến bị huỷ lúc đang xếp (FE-6-07): kho dỡ phần đã xếp. */
  cancelledUnload: { one: 'Dỡ {count} kiện đã xếp khỏi xe.', other: 'Dỡ {count} kiện đã xếp khỏi xe.' },
  /** Chuyến từ Đang xếp hàng quay về Đã lập kế hoạch (FE-6-02, FE-6-05): kho chờ điều phối viên tối ưu lại và duyệt. */
  replan: {
    title: 'Chờ điều phối tối ưu lại',
    SHORTAGE: 'Điều phối viên đã bỏ kiện thiếu khỏi chuyến {tripId}. Kiện đã soạn giữ nguyên ở khu chờ; kho làm tiếp khi phương án mới được duyệt.',
    DAMAGED: 'Kiện hỏng có kiện khác tựa lên trong phương án nên chuyến {tripId} phải xếp lại theo phương án mới. Chờ điều phối viên tối ưu lại và duyệt.',
    unload: 'Dỡ các kiện đã xếp ra khu chờ.',
  },
  ordersRecomputed: 'Thứ tự xếp tính lại khi duyệt',
  /** Danh sách chuyến `/kho` (D-46). */
  list: {
    title: 'Chuyến cần xếp',
    /** Dòng dưới tiêu đề: số chuyến đang hiện và ngày hôm nay (V2.3 đợt 6). */
    summary: { one: '{count} chuyến · {date}', other: '{count} chuyến · {date}' },
    lookup: 'Tra cứu kiện',
    date: 'Ngày chạy',
    vehicle: 'Xe',
    packages: 'Số kiện',
    progress: 'Tiến độ',
    damaged: { one: 'bỏ lại {count} kiện hỏng', other: 'bỏ lại {count} kiện hỏng' },
    progressLabel: 'Tiến độ xếp chuyến {tripId}',
    /** Nhóm theo trạng thái và dòng phụ của chuyến (FE-6-01). */
    groups: {
      loading: 'Đang xếp hàng',
      waiting: 'Chờ soạn',
      loaded: 'Xếp xong — chờ xuất phát',
      stale: 'Chờ điều phối tối ưu lại',
    },
    start: 'Bắt đầu soạn hàng',
    resume: { staging: 'Tiếp tục soạn ({done}/{total})', loading: 'Tiếp tục xếp ({done}/{total})' },
    openLoaded: 'Xem chuyến đã xếp',
    seal: 'Số seal {number}',
    noSeal: 'Chưa ghi số seal.',
    recheck: {
      one: 'Điều phối viên từ chối {count} xác nhận tay: mở chuyến để kiểm lại kiện.',
      other: 'Điều phối viên từ chối {count} xác nhận tay: mở chuyến để kiểm lại kiện.',
    },
    stale: 'Phương án đã duyệt lỗi thời: xe hoặc kiện đã đổi. Chờ điều phối viên tối ưu lại và duyệt rồi mới xếp.',
    emptyTitle: 'Không có chuyến cần xếp',
    emptyDescription: 'Chuyến có phương án đã duyệt sẽ hiện ở đây để kho bắt đầu soạn hàng.',
  },
  header: {
    exit: 'Thoát phiên xếp hàng',
    step: 'Bước',
    progress: 'Tiến độ xếp hàng',
    trip: 'Chuyến',
  },
  card: {
    title: 'Kiện cần xếp',
    stop: 'Điểm {number} · {name}',
    /** Vùng theo điểm giao của kiện trong thùng (FE-6-05): tên điểm giao của vùng và chỗ của vùng. */
    zone: 'Vùng {name} — {place}',
    zonePlace: { door: 'sát cửa', middle: 'giữa thùng', front: 'sát vách trước', whole: 'cả thùng' },
  },
  viewerLoading: 'Đang dựng sơ đồ thùng xe',
  confirmed: 'Đã xếp {id}',
  nextStep: 'Chuyển sang bước {step}…',
  finishing: 'Đang hoàn tất xếp hàng…',
  /** Hộp hỏi lại trước khi báo thiếu một kiện ở bước soạn (FE-6-02). */
  missingDialog: {
    title: 'Báo thiếu {id}?',
    description: 'Kiện {id} được báo là không tìm thấy. Điều phối viên sẽ quyết: tìm tiếp, hoặc bỏ kiện khỏi chuyến rồi tối ưu lại. Kho soạn tiếp các kiện khác.',
    confirm: 'Báo thiếu',
    cancel: 'Quay lại',
  },
  /** Bước Soạn hàng (FE-6-02, D-82): quét mọi kiện vào khu chờ, không cần thứ tự. */
  staging: {
    step: 'Đã soạn',
    progress: 'Tiến độ soạn hàng',
    title: 'Kiện chưa soạn ({count})',
    hint: 'Đưa từng kiện vào khu chờ và đối chiếu nhãn của nó, không cần theo thứ tự. Không tìm thấy kiện nào thì báo thiếu kiện đó.',
    listLabel: 'Kiện chưa soạn',
    reportShortage: 'Báo thiếu',
    reported: 'Đã báo thiếu — chờ điều phối',
    shortages: {
      one: 'Thiếu {count} kiện — chờ điều phối viên quyết. Soạn tiếp các kiện còn lại.',
      other: 'Thiếu {count} kiện — chờ điều phối viên quyết. Soạn tiếp các kiện còn lại.',
    },
    shortageRecorded: 'Đã báo thiếu {id}',
    shortageRecordedDescription: 'Điều phối viên được báo. Soạn tiếp các kiện khác.',
    scanTitle: 'Đối chiếu kiện vào khu chờ',
    scanDescription: 'Quét nhãn QR của kiện vừa đưa vào khu chờ, hoặc gõ mã in trên nhãn. Đã soạn {done} / {total} kiện.',
    lastStaged: 'Đã soạn {id} · {name}.',
    alreadyStaged: 'Kiện {id} · {name} đã soạn rồi, không ghi lại.',
    manualRecorded: 'Đã ghi xác nhận tay {id}',
  },
  /** Kiện hỏng ở bước xếp (FE-6-05, D-92). */
  damaged: {
    open: 'Kiện hỏng',
    title: 'Ghi {id} là kiện hỏng?',
    noSupport: 'Kiện về kho kiện kèm cờ Hư hỏng và không lên xe. Trong phương án không kiện nào tựa lên nó: kho xếp tiếp các kiện còn lại.',
    withSupport: {
      one: 'Kiện về kho kiện kèm cờ Hư hỏng. Trong phương án có {count} kiện tựa lên nó: chuyến quay về Đã lập kế hoạch, kho phải dỡ ra và xếp lại theo phương án mới.',
      other: 'Kiện về kho kiện kèm cờ Hư hỏng. Trong phương án có {count} kiện tựa lên nó: chuyến quay về Đã lập kế hoạch, kho phải dỡ ra và xếp lại theo phương án mới.',
    },
    confirm: 'Ghi kiện hỏng',
    cancel: 'Quay lại',
    recorded: 'Đã bỏ lại kiện hỏng {id}',
    recordedDescription: 'Kiện không lên xe. Xếp tiếp kiện kế tiếp.',
    replan: 'Kiện hỏng {id}: chuyến về Đã lập kế hoạch',
    replanDescription: 'Phải dỡ ra và xếp lại theo phương án mới. Chờ điều phối viên tối ưu lại và duyệt.',
  },
  allRecorded: 'Mọi kiện đã có kết quả. Bấm Hoàn tất xếp hàng để chuyển chuyến sang Xếp xong — chờ xuất phát.',
  complete: 'Hoàn tất xếp hàng',
  finished: {
    title: 'Đã xếp xong chuyến {tripId}',
    loaded: 'Đã xếp {loaded} / {total} kiện',
    damagedTitle: { one: 'Kiện hỏng, bỏ lại kho ({count})', other: 'Kiện hỏng, bỏ lại kho ({count})' },
    noDamaged: 'Không có kiện nào bị bỏ lại.',
    description: 'Xếp xong — chờ xuất phát. Đóng cửa thùng và bàn giao cho tài xế.',
    /** Hai ô số của màn Xếp xong (V2.3 đợt 6): đã xếp trên tổng, và kiện hỏng bỏ lại kho. */
    tiles: { loaded: 'Đã xếp', ofTotal: '/ {total} kiện', left: 'Bỏ lại kho', unit: 'kiện' },
    byStop: {
      title: 'Theo điểm giao',
      left: { one: 'bỏ lại {count}', other: 'bỏ lại {count}' },
    },
  },
  /** Đối chiếu kiện khi xếp (LM-104; ba mức từ FE-6-03): chỉ kiện của bước hiện tại được ghi. */
  scan: {
    open: 'Đối chiếu kiện',
    title: 'Đối chiếu kiện bước {step}',
    description: 'Quét nhãn QR trên kiện đang cầm, hoặc gõ mã in trên nhãn. Bước này cần kiện {id} · {name}.',
    wrongPackage: 'Sai kiện hoặc sai thứ tự: vừa đưa {scanned} ({scannedName}), bước này cần {expected} ({expectedName}). Chưa ghi gì — để kiện này sang bên và đối chiếu đúng kiện.',
    manualRecorded: 'Đã ghi xác nhận tay {id}',
    manualRecordedDescription: 'Chờ điều phối viên duyệt trước khi xong xếp.',
    recordedByQr: { one: 'Đã đối chiếu bằng nhãn {count} kiện', other: 'Đã đối chiếu bằng nhãn {count} kiện' },
  },
  /** Xác nhận tay của phiên ở kho, lúc soạn và lúc xếp (FE-6-04): còn chờ điều phối viên duyệt thì chưa xong xếp; bị từ chối thì kiểm lại kiện đó. */
  confirms: {
    pending: { one: 'Còn {count} xác nhận tay chờ điều phối viên duyệt.', other: 'Còn {count} xác nhận tay chờ điều phối viên duyệt.' },
    blocked: {
      one: 'Mọi kiện đã có kết quả, nhưng còn {count} xác nhận tay chờ điều phối viên duyệt nên chưa hoàn tất xếp hàng được.',
      other: 'Mọi kiện đã có kết quả, nhưng còn {count} xác nhận tay chờ điều phối viên duyệt nên chưa hoàn tất xếp hàng được.',
    },
    /** Lớp phủ "Đã xếp" của kiện cuối khi còn xác nhận tay chờ duyệt: chuyến chưa hoàn tất xếp. */
    overlayWaiting: 'Chờ điều phối viên duyệt xác nhận tay rồi mới hoàn tất xếp hàng.',
    rejected: 'Điều phối viên từ chối xác nhận tay kiện {id}. Kiểm lại kiện này rồi đối chiếu lại.',
    rejectReason: 'Lý do: {reason}',
  },
  /** Số seal niêm phong thùng khi xếp xong (luồng 5 Review 1, LM-104): không bắt buộc, có thì ghi vào chuyến. */
  seal: {
    title: 'Niêm phong thùng',
    description: 'Ghi số seal trên niêm phong cửa thùng để tài xế và người nhận đối chiếu. Không có seal thì bỏ qua.',
    label: 'Số seal',
    hint: 'Tối đa {max} ký tự, ví dụ SEAL-240914.',
    required: 'Nhập số seal trước khi ghi.',
    tooLong: 'Số seal tối đa {max} ký tự.',
    submit: 'Ghi số seal',
    change: 'Đổi số seal',
    recorded: 'Số seal {number} · ghi lúc {time}',
    none: 'Chuyến này không ghi số seal.',
    locked: 'Xe đã rời kho: không đổi số seal được nữa.',
  },
  tiles: {
    position: 'Vị trí',
    orientation: 'Hướng đặt',
    weight: 'Khối lượng',
  },
  layer: 'Lớp {layer} · Cách cửa {rear}',
  distances: {
    front: 'Cách vách trước',
    left: 'Cách vách trái',
    right: 'Cách vách phải',
    rear: 'Cách cửa sau',
    floor: 'Cách sàn',
    below: 'Phía dưới gần nhất',
    noneBelow: 'Không có kiện',
    obstacle: 'Vật cản gần nhất',
    obstacleValue: '{type} {id} · khe {gap}',
  },
  /** Mã hướng đặt Spec đọc theo trục X, Y, Z của thùng; "mặt trên gốc" là mặt trên khi kiện đứng thẳng. */
  orientations: {
    LWH: 'Đứng thẳng · cạnh dài dọc thùng',
    WLH: 'Đứng thẳng · cạnh dài ngang thùng',
    LHW: 'Nằm nghiêng · mặt trên gốc quay sang vách bên',
    WHL: 'Dựng đứng cạnh dài · mặt trên gốc quay sang vách bên',
    HLW: 'Nằm nghiêng · mặt trên gốc quay theo chiều dọc thùng',
    HWL: 'Dựng đứng cạnh dài · mặt trên gốc quay theo chiều dọc thùng',
  },
  notes: {
    fragile: 'Dễ vỡ — không đặt vật nặng lên trên',
    fragileBelow: 'Phía dưới có kiện dễ vỡ — kiểm tra cách nâng đỡ',
    heavy: 'Nặng — hai người khiêng hoặc dùng xe nâng tay',
    notUpright: 'Đặt nằm đúng như hình — mặt trên gốc không hướng lên',
    default: 'Mặt trên gốc hướng lên, đặt khít kiện bên cạnh',
  },
  figure: {
    label: 'Minh hoạ hướng đặt {code}: mũi tên đen chỉ ra cửa sau, mũi tên xanh chỉ mặt trên gốc của kiện',
    front: 'Vách trước',
    door: 'Cửa sau',
    doorArrow: 'Mũi tên đen: hướng ra cửa sau',
    topArrow: 'Mũi tên xanh: mặt trên gốc của kiện',
  },
} as const
