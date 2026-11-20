/**
 * Phần "Thử với hàng của bạn" của trang giới thiệu (`#thu-ngay`, `features/marketing/try`): khách nhập thùng xe và kiện hàng, bộ tối ưu
 * mô phỏng của ứng dụng chạy ngay trên trình duyệt và trả ba phương án A · B · C. Không nhãn MOCK RESULT trên trang công khai: câu nguồn
 * dưới kết quả nói số do bộ tối ưu mô phỏng tính.
 */
export const landingTry = {
  title: 'Thử với hàng của bạn',
  lede: 'Nhập thùng xe và kiện hàng của bạn rồi bấm chạy: bộ tối ưu tính ba phương án ngay trên trình duyệt này — không cần tài khoản.',
  tabs: {
    label: 'Chọn bản thử',
    pack: 'Xếp thử xe của bạn',
    axle: 'Tải trục',
  },
  form: {
    label: 'Thùng xe và kiện hàng của bạn',
    run: 'Tính ba phương án',
    howSubject: 'bản thử',
    privacy: 'Số bạn nhập chỉ nằm trên trình duyệt này, không gửi lên máy chủ.',
    /** Khi có ô mô tả (trợ lý AI): số trong form vẫn ở lại trình duyệt, chỉ mô tả bằng lời được gửi đi. */
    privacyWithDescribe: 'Số trong form chỉ nằm trên trình duyệt này. Chỉ mô tả bằng lời ở trên được gửi đi, và chỉ khi bạn bấm “Điền giúp tôi”.',
  },
  /**
   * Ô "Mô tả hàng bằng lời" đầu tab xếp thử (`try/TryDescribe`), chỉ khi nhóm `assistant` nối máy chủ: khách gõ mô tả, máy chủ đọc ra số
   * rồi app điền form — khách tự bấm "Tính ba phương án". `{run}` là chữ của nút đó (`form.run`).
   */
  describe: {
    label: 'Mô tả hàng bằng lời',
    hint: 'Ví dụ: “Xe 5 tấn, thùng 6 × 2,3 × 2,4 m. 200 thùng 40 × 30 × 30 cm nặng 12 kg giao điểm 1, 20 kiện 120 × 100 × 150 cm 80 kg giao điểm 2.”',
    count: '{count} / {max} ký tự',
    submit: 'Điền giúp tôi',
    disclosure: 'Khi bạn bấm “Điền giúp tôi”, mô tả này được gửi tới máy chủ LoadMaster và Anthropic — nhà cung cấp mô hình AI — để điền form. Lumo là trợ lý AI và có thể đọc nhầm: kiểm lại số trước khi tính.',
    reading: 'Lumo đang đọc mô tả…',
    filled: {
      one: 'Đã điền thùng xe và {count} loại kiện. Kiểm lại rồi bấm “{run}”.',
      other: 'Đã điền thùng xe và {count} loại kiện. Kiểm lại rồi bấm “{run}”.',
    },
    filledCartons: {
      one: 'Đã điền {count} loại kiện, thùng xe giữ nguyên. Kiểm lại rồi bấm “{run}”.',
      other: 'Đã điền {count} loại kiện, thùng xe giữ nguyên. Kiểm lại rồi bấm “{run}”.',
    },
    noCartons: 'Chưa nhận ra kiện hàng nào trong mô tả, nên form giữ nguyên. Hãy ghi rõ kích thước, khối lượng và số kiện.',
    assumptions: 'Lumo đã giả định',
    missing: 'Cần bạn nhập thêm',
    /** Nhãn của từng mục trong `missing` của máy chủ. */
    gaps: {
      truck: {
        lengthCm: 'Chiều dài thùng',
        widthCm: 'Chiều rộng thùng',
        heightCm: 'Chiều cao thùng',
        payloadKg: 'Tải trọng xe',
      },
      carton: {
        lengthCm: 'Chiều dài — loại kiện {number}',
        widthCm: 'Chiều rộng — loại kiện {number}',
        heightCm: 'Chiều cao — loại kiện {number}',
        weightKg: 'Khối lượng — loại kiện {number}',
        quantity: 'Số kiện — loại kiện {number}',
        stop: 'Điểm giao — loại kiện {number} (đang tạm để điểm 1)',
      },
      cartonKinds: 'Chỉ giữ {max} loại kiện đầu',
      totalQuantity: 'Tổng số kiện vượt {max}',
    },
    /** Chưa điền được: form giữ nguyên, khách nhập tay. */
    errors: {
      rateLimited: 'Lumo đang nhận quá nhiều yêu cầu nên chưa điền giúp được. Thử lại sau ít phút, hoặc nhập số vào form.',
      budget: 'Hôm nay Lumo đã hết lượt đọc mô tả nên chưa điền giúp được. Bạn nhập số vào form nhé.',
      unavailable: 'Lumo chưa đọc được mô tả lúc này nên chưa điền giúp được. Bạn nhập số vào form nhé.',
      tooLong: 'Mô tả dài quá {max} ký tự nên chưa điền giúp được. Rút gọn mô tả, hoặc nhập số vào form.',
      invalid: 'Máy chủ không nhận mô tả này nên chưa điền giúp được. Sửa lại mô tả, hoặc nhập số vào form.',
      network: 'Không kết nối được máy chủ nên chưa điền giúp được. Thử lại sau, hoặc nhập số vào form.',
      other: 'Chưa điền giúp được. Bạn nhập số vào form nhé.',
    },
  },
  truck: {
    legend: 'Thùng xe',
    lengthCm: 'Dài (cm)',
    widthCm: 'Rộng (cm)',
    heightCm: 'Cao (cm)',
    payloadKg: 'Tải trọng (kg)',
    note: 'Đo lòng thùng bên trong. Bản thử coi cửa sau mở hết lòng thùng, không có vật cản và không hỏi trục xe.',
  },
  cartons: {
    legend: 'Loại kiện {number}',
    lengthCm: 'Dài (cm)',
    widthCm: 'Rộng (cm)',
    heightCm: 'Cao (cm)',
    weightKg: 'Nặng (kg)',
    quantity: 'Số kiện',
    stop: 'Điểm giao',
    stopOption: 'Điểm {number}',
    add: 'Thêm loại kiện',
    remove: 'Bỏ loại kiện {number}',
    total: 'Tổng {total} / {max} kiện',
    rulesLabel: 'Kiện hàng',
    rules: 'Kiện giữ đứng, xoay được trên sàn và xếp chồng được — mỗi kiện chịu tối đa gấp ba khối lượng của nó đè lên. Điểm 1 giao trước.',
  },
  errors: {
    required: 'Nhập một số',
    number: 'Chỉ nhập số, tối đa hai chữ số sau dấu thập phân',
    integer: 'Nhập số nguyên',
    range: 'Từ {min} đến {max}',
    totalQuantity: 'Bản thử xếp tối đa {max} kiện mỗi lần',
  },
  results: {
    title: 'Ba phương án của lần chạy',
    idle: 'Bấm “Tính ba phương án” để xem kết quả với số đang nhập.',
    plan: 'Phương án {label}',
    sameAs: 'Giống hệt phương án {label}',
    placed: 'Xếp được',
    placedValue: '{placed} / {total}',
    volume: 'Lấp đầy thể tích',
    balance: 'Trọng tâm lệch giữa thùng',
    rehandling: 'Kiện dỡ-xếp lại',
    unplacedTitle: 'Chưa xếp',
    unplacedRow: 'Loại kiện {kind}: {count} kiện — {reason}',
    /** Bản thử coi cửa sau là cả mặt cắt lòng thùng, nên "không lọt cửa" của bộ tối ưu nghĩa là kiện cao hoặc rộng hơn lòng thùng. */
    doorTooSmall: 'Cao hoặc rộng hơn lòng thùng',
    legend: 'Màu kiện theo điểm giao',
    stopName: 'Điểm {number}',
    balanceNote: 'Bản thử không hỏi trục xe nên không tính tải trục: phương án B cân bằng bằng cách đưa trọng tâm hàng về giữa chiều dài thùng.',
    singleStopNote: 'Mọi kiện cùng một điểm giao nên không kiện nào phải dỡ-xếp lại — chọn điểm giao khác nhau cho các loại kiện để so số này.',
    source: 'Số do bộ tối ưu mô phỏng của LoadMaster chạy trên trình duyệt của bạn tính, một lần chạy cho cả ba phương án.',
    stale: 'Số trong form đã đổi sau lần tính này — bấm “Tính ba phương án” để tính lại.',
  },
  announce: {
    running: 'Đang tính ba phương án.',
    done: 'Đã tính xong ba phương án cho {total} kiện.',
  },
  failure: {
    invalid: 'Bộ tối ưu không nhận các số này:',
    failed: 'Bộ tối ưu không tìm được phương án nào với các số này.',
    timeout: 'Bộ tối ưu chạy quá {seconds} giây nên đã dừng.',
    service: 'Trình duyệt này chưa chạy được bộ tối ưu mô phỏng. Hãy thử tải lại trang.',
  },
  /** Tab "Tải trục": kéo khối lượng và trọng tâm hàng, xem tải hai nhóm trục của xe mẫu (`try/TryAxleTab`). */
  axle: {
    title: 'Hàng dồn lên trục nào?',
    vehicle: 'Xe mẫu: xe tải 3,5 tấn, lòng thùng dài {length}, tải trọng {payload}. Trục trước nằm dưới cabin, trước vách trước của thùng {frontAxle}; trục sau cách vách trước {rearAxle}.',
    mass: 'Khối lượng hàng',
    center: 'Trọng tâm hàng, tính từ vách trước',
    centerHint: 'Số nhỏ là hàng dồn về phía cabin, số lớn là dồn về phía cửa sau.',
    resultTitle: 'Tải lên hai trục',
    groups: { front: 'Trục trước', rear: 'Trục sau' },
    loadOfLimit: '{load} / {limit}',
    percent: '{value} giới hạn',
    over: 'Vượt {over}',
    within: 'Cả hai trục trong giới hạn.',
    overFront: 'Trục trước vượt giới hạn {over} — lùi hàng về phía cửa sau hoặc bớt hàng.',
    overRear: 'Trục sau vượt giới hạn {over} — đưa hàng về phía cabin hoặc bớt hàng.',
    overBoth: 'Cả hai trục vượt giới hạn — bớt hàng.',
    source: 'Số tính theo mô hình đòn bẩy trên hai trục đã khai của xe mẫu. Đây là ước lượng: tải khi xe rỗng lấy theo số đã khai, không tính riêng nhiên liệu hay người lái.',
    howSubject: 'tải trục',
  },
  next: {
    sample: 'Xem phương án mẫu ở dạng 3D',
    lead: 'Trong ứng dụng, điều phối viên chạy tối ưu với xe đã khai trục, kiện và điểm giao của chuyến thật.',
    trial: 'Đăng ký trải nghiệm',
    contact: 'Nhận tư vấn',
    forYourCargo: 'cho hàng của bạn',
  },
} as const
