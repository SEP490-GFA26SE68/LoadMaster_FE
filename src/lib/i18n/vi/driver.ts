/**
 * Màn tài xế (LM-061, LM-087, FE-6-06): "Chuyến của tôi", giao từng điểm theo revision đã duyệt — xuất phát, đã đến, dỡ hàng có đối
 * chiếu, gọi người nhận, báo sự cố, hoàn trả, tổng kết chuyến — và khung 3D "Xem vị trí hàng".
 */
export const driver = {
  loading: 'Đang tải chuyến',
  emptyTitle: 'Chưa có phương án đã duyệt',
  emptyTripDescription: 'Chuyến {tripId} chưa có phương án đã duyệt. Điều phối viên cần duyệt phương án xếp hàng của chuyến trước.',
  loadErrorTitle: 'Không tải được chuyến',
  retry: 'Thử lại',
  toTrips: 'Về danh sách chuyến',
  cancelledTitle: 'Chuyến đã huỷ',
  cancelledDescription: 'Chuyến {tripId} đã huỷ: {reason}',
  /**
   * Chuyến ở Đã lập kế hoạch chưa hiện ở "Chuyến của tôi" (FE-6-01): màn chuyến chỉ nói lý do, không xem trước phương án còn có thể đổi.
   * `replan`: chuyến đang xếp vừa quay về Đã lập kế hoạch (FE-6-02, FE-6-05), theo lý do kho ghi — tới khi kho soạn lại hàng.
   */
  planningTitle: 'Kho chưa soạn hàng chuyến này',
  planningDescription: 'Chuyến {tripId} còn đang lập kế hoạch. Khi kho bắt đầu soạn hàng, chuyến hiện ở "Chuyến của tôi".',
  replan: {
    title: 'Chuyến tạm dừng',
    DAMAGED: 'Kho báo một kiện của chuyến {tripId} bị hỏng lúc xếp nên chuyến quay về lập kế hoạch. Điều phối lập lại phương án rồi kho soạn lại hàng; khi đó chuyến hiện lại ở "Chuyến của tôi".',
    SHORTAGE: 'Kho không tìm thấy một kiện của chuyến {tripId} lúc soạn hàng, điều phối đã bỏ kiện đó khỏi chuyến. Điều phối lập lại phương án rồi kho soạn lại hàng; khi đó chuyến hiện lại ở "Chuyến của tôi".',
  },
  exit: 'Thoát màn hình tài xế',
  /** Danh sách "Chuyến của tôi" `/tai-xe` (D-46). */
  list: {
    title: 'Chuyến của tôi',
    /** Nhóm theo trạng thái và dòng phụ của chuyến (FE-6-01). */
    groups: {
      inTransit: 'Đang vận chuyển',
      loaded: 'Xếp xong — chờ xuất phát',
      preparing: 'Kho đang soạn / xếp',
      recent: 'Đã giao gần đây',
    },
    noReady: 'Chưa có chuyến nào xếp xong hoặc đang vận chuyển.',
    open: 'Mở chuyến',
    preview: 'Xem trước',
    resume: 'Tiếp tục giao',
    viewSummary: 'Xem tổng kết',
    stops: { one: '{count} điểm giao', other: '{count} điểm giao' },
    atStop: 'Đang giao điểm {number} / {total}',
    waitingLoading: 'Kho đang soạn / xếp — chưa xuất phát được, chỉ xem trước.',
    recheck: {
      one: 'Điều phối viên từ chối {count} xác nhận tay: mở chuyến để kiểm lại kiện.',
      other: 'Điều phối viên từ chối {count} xác nhận tay: mở chuyến để kiểm lại kiện.',
    },
    completed: 'Hoàn thành lúc {time} · {date}',
    issues: { one: '{count} sự cố', other: '{count} sự cố' },
    /** Tên danh sách các điểm trong thẻ chuyến (V2.3 đợt 6). */
    stopsLabel: 'Các điểm của chuyến {tripId}',
    emptyTitle: 'Chưa có chuyến nào',
    emptyDescription: 'Chuyến điều phối viên giao cho bạn sẽ hiện ở đây.',
    /** Dữ liệu từ backend: backend chỉ trả chuyến đang vận chuyển. */
    emptyDescriptionInTransit: 'Chuyến đang vận chuyển của bạn sẽ hiện ở đây.',
  },
  notice: {
    preview: 'Kho chưa xếp xong chuyến này: bạn xem trước được, chưa xuất phát được.',
    ready: 'Kho đã xếp xong. Bấm Xuất phát khi xe rời kho.',
    /** Đang vận chuyển (FE-6-06): chưa bấm "Đã đến" ở điểm đang giao, và giờ đã đến. */
    enRoute: 'Đang tới điểm {number}. Đến nơi thì bấm Đã đến rồi mới dỡ hàng.',
    arrived: 'Đã đến điểm {number} lúc {time}.',
    leftOut: {
      one: '{count} kiện của điểm này hỏng lúc xếp, đã bỏ lại kho: không có trên xe, không cần dỡ.',
      other: '{count} kiện của điểm này hỏng lúc xếp, đã bỏ lại kho: không có trên xe, không cần dỡ.',
    },
  },
  /** Công tắc "Dùng GPS thật" khi chuyến Đang vận chuyển (FE-6-13, D-85, D-95). */
  gps: {
    title: 'Vị trí xe',
    toggle: 'Dùng GPS thật',
    localOnly: 'Chưa có máy chủ: vị trí từ điện thoại chỉ hiện trong trình duyệt này.',
    requesting: 'Đang chờ quyền vị trí và tín hiệu GPS…',
    sent: 'Đã gửi vị trí lúc {time}. Gửi lại mỗi 30 giây.',
    stopped: {
      user: 'Đã tắt GPS thật: vị trí xe về mô phỏng.',
      denied: 'Trình duyệt không cho dùng vị trí: vị trí xe về mô phỏng. Cấp quyền vị trí cho trang rồi bật lại.',
      lost: 'Mất tín hiệu GPS: vị trí xe về mô phỏng. Bật lại khi có tín hiệu.',
      unsupported: 'Thiết bị này không có định vị: vị trí xe là mô phỏng.',
      error: 'Không gửi được vị trí: vị trí xe về mô phỏng. {message}',
    },
    /** Dữ liệu từ backend: không có xe mô phỏng — tắt GPS là thôi gửi vị trí. */
    serverNote: 'Bật để gửi vị trí của điện thoại lên máy chủ cho chuyến này.',
    stoppedServer: {
      user: 'Đã tắt GPS thật: không gửi vị trí nữa.',
      denied: 'Trình duyệt không cho dùng vị trí: chưa gửi được vị trí. Cấp quyền vị trí cho trang rồi bật lại.',
      lost: 'Mất tín hiệu GPS: đã thôi gửi vị trí. Bật lại khi có tín hiệu.',
      unsupported: 'Thiết bị này không có định vị: không gửi được vị trí.',
      error: 'Không gửi được vị trí: đã thôi gửi. {message}',
    },
  },
  start: 'Xuất phát',
  arrive: 'Đã đến điểm {number}',
  stopTitle: 'Điểm {number} / {total}',
  /** Chữ trên hai nút của thẻ liên hệ (V2.3 đợt 6); tên đọc đầy đủ ở `call` và `directions`. */
  callLabel: 'Gọi',
  directionsLabel: 'Chỉ đường',
  directions: 'Chỉ đường tới {name}',
  call: 'Gọi {name}',
  contact: '{name} · {phone}',
  summary: 'Cần dỡ {total} kiện · Đã dỡ {done} · Sự cố {issues}',
  progress: 'Tiến độ dỡ hàng',
  viewCargo: 'Xem vị trí hàng',
  noItems: 'Không có kiện nào của điểm giao này trên xe.',
  remaining: { one: 'Còn {count} kiện chưa dỡ hoặc chưa báo sự cố', other: 'Còn {count} kiện chưa dỡ hoặc chưa báo sự cố' },
  allHandled: 'Mọi kiện của điểm này đã dỡ hoặc đã báo sự cố.',
  complete: 'Hoàn tất điểm giao',
  /** Hộp hỏi lại trước khi hoàn tất điểm giao hoặc điểm nhận: số kiện lấy từ tiến độ của điểm trên màn. */
  completeConfirm: {
    title: 'Hoàn tất điểm {number} — {name}?',
    description: 'Hoàn tất rồi thì không mở lại được điểm này.',
    delivered: { one: '{count} kiện đã dỡ được ghi Đã giao.', other: '{count} kiện đã dỡ được ghi Đã giao.' },
    returned: { one: '{count} kiện chưa dỡ ở lại xe, được ghi Hoàn trả:', other: '{count} kiện chưa dỡ ở lại xe, được ghi Hoàn trả:' },
    issues: { one: 'Đã báo sự cố cho {count} kiện ở điểm này.', other: 'Đã báo sự cố cho {count} kiện ở điểm này.' },
    picked: { one: '{count} kiện đã nhận lên xe, được ghi Đang vận chuyển.', other: '{count} kiện đã nhận lên xe, được ghi Đang vận chuyển.' },
    next: 'Tiếp theo: điểm {number} · {name}.',
    /** Backend chỉ trả tên của điểm đang giao. */
    nextNumber: 'Tiếp theo: điểm {number}.',
    last: 'Đây là điểm cuối: hoàn tất là giao xong chuyến.',
    confirm: 'Hoàn tất',
    cancel: 'Quay lại',
  },
  /**
   * Giờ đến và hạn giao (FE-6-09): ở thẻ liên hệ của điểm đang giao và ở dòng từng điểm của hai danh sách điểm ("Chuyến của tôi", danh sách
   * điểm ở màn điểm giao) — dự kiến theo vị trí xe hoặc theo tuyến, giờ đến thật, hạn.
   */
  timing: {
    expected: 'Dự kiến đến',
    /** Nhãn ngắn trước giờ ở dòng của một điểm trong danh sách điểm: "Dự kiến 08:15". */
    expectedShort: 'Dự kiến',
    arrived: 'Đã đến',
    deadline: 'Hạn giao',
    noDeadline: 'Không có hạn',
    /** Giờ kèm ngày khi không phải hôm nay. */
    dated: '{time} · {date}',
    sources: { PLAN: 'Theo kế hoạch tuyến', SIMULATED: 'Theo vị trí xe mô phỏng', GPS: 'Theo vị trí GPS của xe' },
  },
  item: {
    order: 'Dỡ thứ {order}',
    where: '{area}, {layer}',
    done: 'Đã dỡ',
    issue: 'Sự cố: {kind}',
    returned: 'Hoàn trả — kiện ở lại xe',
    area: { front: 'Sát vách trước', middle: 'Giữa xe', door: 'Gần cửa' },
    layer: { floor: 'sàn', lower: 'lớp dưới', upper: 'lớp trên' },
  },
  /** Đối chiếu kiện khi dỡ (LM-104; ba mức từ FE-6-03): chỉ kiện của điểm đang giao được ghi "đã dỡ". */
  scan: {
    open: 'Đối chiếu kiện dỡ',
    title: 'Đối chiếu kiện dỡ tại điểm {number}',
    description: 'Quét nhãn QR của từng kiện khi đưa xuống xe, hoặc gõ mã in trên nhãn. Điểm {number}: đã dỡ {done} / {total} kiện.',
    lastUnloaded: 'Vừa dỡ {id} · {name}.',
    wrongStop: 'Kiện {id} ({name}) thuộc điểm {stop} · {stopName}, không phải điểm này. Chưa ghi gì — để kiện lại trên xe.',
    manualRecorded: 'Đã ghi xác nhận tay {id}',
    manualRecordedDescription: 'Chờ điều phối viên duyệt trước khi hoàn tất điểm giao.',
    /** Dòng "Đã dỡ" của một kiện kèm cách đối chiếu. */
    via: {
      QR: 'Đã dỡ · quét QR',
      CODE: 'Đã dỡ · gõ mã',
      MANUAL_PENDING: 'Đã dỡ · xác nhận tay, chờ duyệt',
      MANUAL_APPROVED: 'Đã dỡ · xác nhận tay đã duyệt',
    },
  },
  /** Xác nhận tay ở điểm giao (FE-6-04): còn chờ điều phối viên duyệt thì chưa hoàn tất điểm; bị từ chối thì kiểm lại kiện đó. */
  confirms: {
    blocked: {
      one: 'Còn {count} xác nhận tay của điểm này chờ điều phối viên duyệt — chưa hoàn tất điểm giao được.',
      other: 'Còn {count} xác nhận tay của điểm này chờ điều phối viên duyệt — chưa hoàn tất điểm giao được.',
    },
    rejected: 'Điều phối viên từ chối xác nhận tay, kiểm lại kiện này. Lý do: {reason}',
  },
  /** Hộp "Báo sự cố" cho một kiện (D-47): loại + ghi chú, "Khác" bắt buộc ghi chú. */
  issue: {
    report: 'Báo sự cố',
    title: 'Báo sự cố tại điểm {number}',
    description: 'Ghi sự cố cho một kiện của điểm giao này. Sự cố đã ghi không xoá được. Khách từ chối thì kiện ở lại xe và thành Hoàn trả.',
    package: 'Kiện',
    kind: 'Loại sự cố',
    note: 'Ghi chú',
    noteHint: 'Bắt buộc khi chọn Khác.',
    submit: 'Ghi sự cố',
    cancel: 'Quay lại',
    refusedRecorded: 'Khách từ chối {id}',
    refusedRecordedDescription: 'Kiện ở lại xe và thành Hoàn trả khi hoàn tất điểm giao.',
    errors: {
      packageRequired: 'Chọn kiện gặp sự cố.',
      kindRequired: 'Chọn loại sự cố.',
      noteRequired: 'Chọn Khác thì cần ghi chú.',
      noteTooLong: 'Ghi chú tối đa {max} ký tự.',
    },
  },
  /** Loại điểm và danh sách điểm của chuyến (FE-7-05): điểm nhận dọc đường có biểu tượng riêng và chữ riêng. */
  stopKinds: { PICKUP: 'Điểm nhận hàng', DELIVERY: 'Điểm giao hàng' },
  stopList: {
    summary: 'Các điểm của chuyến ({count})',
    label: 'Các điểm của chuyến',
    state: { done: 'Đã xong', current: 'Đang ở điểm này', waiting: 'Chưa tới' },
  },
  /** Kiện nhận dọc đường (FE-7-05, D-88): nhận ở điểm nhận, giao ở điểm giao như kiện thường; có chỗ trong khung 3D khi vừa vùng trống (FE-BL-01). */
  pickup: {
    banner: 'Điểm nhận hàng dọc đường: nhận {count} kiện từ {name}. Đối chiếu từng kiện lên xe rồi mới hoàn tất điểm nhận.',
    listTitle: 'Kiện nhận dọc đường',
    listHint: 'Kiện nhận không nằm trong phương án xếp hàng; chỗ xếp của chúng hiện trong khung 3D "Xem vị trí hàng". Đối chiếu bằng nhãn QR như kiện thường.',
    request: 'Yêu cầu {id}',
    pick: { waiting: 'Chưa nhận', done: 'Đã nhận' },
    deliver: { waiting: 'Chưa dỡ', done: 'Đã dỡ' },
    via: {
      QR: 'quét QR',
      CODE: 'gõ mã',
      MANUAL_PENDING: 'xác nhận tay, chờ duyệt',
      MANUAL_APPROVED: 'xác nhận tay đã duyệt',
    },
    summary: 'Cần nhận {total} kiện · Đã nhận {done}',
    progress: 'Tiến độ nhận hàng',
    remaining: { one: 'Còn {count} kiện chưa đối chiếu', other: 'Còn {count} kiện chưa đối chiếu' },
    allHandled: 'Mọi kiện của điểm nhận này đã đối chiếu.',
    scanOpen: 'Đối chiếu kiện nhận',
    scanTitle: 'Đối chiếu kiện nhận tại điểm {number}',
    scanDescription: 'Quét nhãn QR của từng kiện khi đưa lên xe, hoặc gõ mã in trên nhãn. Điểm {number}: đã nhận {done} / {total} kiện.',
    lastPicked: 'Vừa nhận {id} · {name}.',
    candidate: 'Kiện nhận · yêu cầu {request}',
    complete: 'Hoàn tất điểm nhận',
    blocked: {
      one: 'Còn {count} xác nhận tay của điểm này chờ điều phối viên duyệt — chưa hoàn tất điểm nhận được.',
      other: 'Còn {count} xác nhận tay của điểm này chờ điều phối viên duyệt — chưa hoàn tất điểm nhận được.',
    },
    cargoTitle: 'Kiện nhận dọc đường — chưa có chỗ trên xe',
    cargoNote: 'Các kiện này không vừa vùng đã trống nên chưa có vị trí trong khung 3D; xếp theo hướng dẫn của điều phối viên và đối chiếu bằng nhãn QR ở màn điểm giao.',
    cargoRow: '{id} · {name} · {weight} · {reason}',
  },
  /** Nút "Thêm" ở chân màn điểm giao: tờ trượt từ đáy chứa hai việc ít dùng khi chuyến đang chạy (V2.3 đợt 6). */
  more: { open: 'Thêm', title: 'Thêm thao tác', description: 'Những việc ít dùng khi xe đang trên đường.' },
  /** Màn tổng kết khi giao xong điểm cuối. */
  tripSummary: {
    title: 'Tổng kết chuyến',
    heading: 'Đã giao xong chuyến {tripId}',
    stops: 'Số điểm giao',
    delivered: 'Kiện đã giao',
    issues: 'Sự cố',
    time: 'Thời gian',
    timeRange: '{start} – {end} · {date}',
    noIssues: 'Không có sự cố.',
    issueWhere: '{id} · Điểm {stop}',
    wholeStop: 'Cả điểm giao · Điểm {stop}',
    stopsTitle: 'Điểm giao',
    stopLine: { one: 'Đã giao {time} · {count} kiện', other: 'Đã giao {time} · {count} kiện' },
  },
  cargo: {
    title: 'Vị trí hàng tại điểm giao',
    description: 'Mô phỏng dỡ theo thứ tự dỡ của phương án đã duyệt, vị trí kiện và cảnh báo lối dỡ.',
    close: 'Đóng 3D',
    stop: 'Điểm {number} / {total} · {name}',
    view: 'Góc nhìn hàng',
    presets: { rear: 'Cửa sau', top: 'Trên', diagonal: 'Góc chéo', side: 'Bên hông' },
    noDelivery: 'Mô phỏng không đánh dấu giao hàng',
    current: 'Hiện tại {id}',
    allViewed: 'Đã xem hết các kiện cần dỡ',
    next: 'Tiếp theo {id}',
    focus: 'Tập trung vào kiện',
    selected: '{id} · Điểm {stop} · {orientation}',
    backToCurrent: 'Quay lại kiện cần dỡ',
    skipStep: 'Bỏ qua bước trong mô phỏng',
  },
  /**
   * Màn điểm giao khi dữ liệu từ backend (`BackendDriverStop`): điểm đang giao luôn dỡ được (backend chưa có bước "Đã đến"), dỡ bằng mã
   * gõ trên nhãn, không có sự cố theo kiện — và vì sao không mở được chuyến.
   */
  backend: {
    notInTransitTitle: 'Chuyến không đang vận chuyển',
    notInTransitDescription: 'Chuyến này không có trong các chuyến đang vận chuyển của bạn.',
    noStopsTitle: 'Không còn điểm nào cần giao',
    noStopsDescription: 'Chuyến {tripId} không còn điểm giao nào chờ giao.',
    completedTitle: 'Đã giao xong chuyến',
    completedDescription: 'Chuyến {tripId}: mọi điểm giao đã hoàn tất.',
    atStop: 'Đang giao điểm {number}: gõ mã trên nhãn của từng kiện khi đưa xuống xe.',
    scanDescription: 'Gõ mã của từng kiện khi đưa xuống xe. Điểm {number}: đã dỡ {done} / {total} kiện.',
    /** Ô gõ mã của hộp đối chiếu: backend chưa trả mã QR và mã của bên gửi cho tài xế, nên chỉ nhận mã đứng đầu dòng kiện và mã của kho kiện. */
    codeLabel: 'Mã kiện',
    codeHint: 'Mã đứng đầu dòng kiện trên màn này, hoặc mã của kho kiện in ở góc trên nhãn. Chữ hoa hay thường đều được.',
    summary: 'Cần dỡ {total} kiện · Đã dỡ {done}',
    remaining: { one: 'Còn {count} kiện chưa dỡ', other: 'Còn {count} kiện chưa dỡ' },
    allUnloaded: 'Đã dỡ mọi kiện của điểm này.',
    codeUnmatched: 'Mã {code} không khớp kiện nào của điểm này. Chưa ghi gì — kiểm tra lại mã trên nhãn.',
    codeAmbiguous: 'Mã {code} trùng {count} kiện của điểm này. Chưa ghi gì — gõ mã đứng đầu dòng kiện.',
    alreadyUnloaded: 'Kiện {code} đã được ghi dỡ trước đó.',
    wrongStop: 'Kiện {code} không thuộc điểm đang giao. Chưa ghi gì — để kiện lại trên xe.',
  },
} as const
