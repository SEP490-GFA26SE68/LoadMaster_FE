/**
 * Trợ lý "Hỏi Lumo" của hai trang công khai `/gioi-thieu`, `/bang-gia` (`features/marketing/assistant`). Lumo trả lời từ bộ câu trả lời
 * soạn sẵn (`assistant-kb.ts`), không phải AI và không phải nhân viên — dòng nhỏ dưới ô gõ (`disclaimer`) nói rõ điều đó. Tên Lumo là tên riêng, không vào từ
 * điển: câu nói về Lumo nhận tham số `{name}`. Mỗi câu trả lời tối đa ba câu ngắn; số (credit, số luật, số mục tiêu) đi qua tham số từ
 * hằng của code, giá gói đọc từ danh mục gói.
 */
export const assistant = {
  launcher: {
    label: 'Hỏi {name}',
  },
  panel: {
    subtitle: 'Hỏi đáp về LoadMaster',
    close: 'Đóng trợ lý',
    restart: 'Bắt đầu lại',
    log: 'Cuộc trò chuyện với {name}',
    /** Dòng nhỏ dưới ô gõ, cũng là mô tả của khung chat cho trình đọc màn hình. */
    disclaimer: '{name} trả lời từ tài liệu của LoadMaster — không phải nhân viên tư vấn.',
    /** Màn chào khi chưa hỏi gì. */
    greeting: 'Chào bạn, mình là {name}.',
    introHint: 'Hỏi mình về gói cước, credit, cách LoadMaster xếp hàng hay cách dùng thử.',
    starters: 'Câu hỏi gợi ý',
    followUps: 'Hỏi tiếp',
    typing: '{name} đang trả lời…',
    you: 'Bạn hỏi',
    says: '{name} trả lời',
    error: 'Chưa trả lời được câu này. Bạn thử gửi lại nhé.',
    inputLabel: 'Câu hỏi của bạn',
    placeholder: 'Gõ câu hỏi…',
    send: 'Gửi câu hỏi',
  },
  /** Mỗi chủ đề: `chip` là câu hỏi ngắn trên nút gợi ý, `answer` là câu trả lời (không tham số). */
  topics: {
    plans: {
      chip: 'Giá các gói?',
      answer: 'Mỗi gói tính theo tháng và kèm credit để chạy tối ưu xếp hàng 3D. Đây là các gói đang bán:',
    },
    credit: {
      chip: 'Một lần tối ưu tốn bao nhiêu credit?',
      answer: 'Tối ưu thứ tự điểm giao không tốn credit. Credit còn thừa cuối kỳ không cộng dồn sang kỳ sau.',
    },
    advisor: {
      chip: 'Gói nào hợp với công ty tôi?',
      answer: 'Mỗi tháng công ty bạn chạy tối ưu xếp hàng khoảng bao nhiêu lần? Chọn một mức hoặc nhập số để tính credit cần và gói rẻ nhất đủ dùng.',
    },
    start: {
      chip: 'Dùng thử thế nào?',
      answer: 'Bạn gửi yêu cầu dùng thử qua form liên hệ. Đội LoadMaster tạo tài khoản công ty cho bạn sau khi nhận yêu cầu.',
      answerSelf:
        'Bạn tự đăng ký dùng thử gói Basic: nhập thông tin công ty, xác nhận mã gửi qua email, rồi đội LoadMaster duyệt yêu cầu. Muốn dùng ngay thì đăng ký gói trả phí. Tài khoản dùng thử cần ký thoả thuận dịch vụ trong 72 giờ.',
    },
    howItWorks: {
      chip: 'LoadMaster hoạt động thế nào?',
      answer: 'Một chuyến hàng đi qua năm chặng:',
    },
    roles: {
      chip: 'Ai trong công ty dùng LoadMaster?',
      answer: 'Mỗi người dùng LoadMaster theo vai trò của mình, trên thiết bị hợp với việc đó:',
    },
    devices: {
      chip: 'Có dùng được trên điện thoại không?',
      answer:
        'Có. Nhân viên kho dùng trên máy tính bảng, tài xế dùng trên điện thoại, ngay trong trình duyệt: nút lớn, chữ lớn, mỗi màn một việc. Tài xế còn xem được vị trí từng kiện trên xe bằng hình 3D.',
    },
    packages: {
      chip: 'Nhập kiện hàng thế nào?',
      answer:
        'Nhân viên kho nhập kiện từ file Excel theo mẫu hoặc thêm từng kiện. Trước khi lưu, LoadMaster cho xem trước và chỉ ra dòng nào sai. Mỗi kiện có mã QR riêng để in nhãn dán lên kiện.',
    },
    verify: {
      chip: 'Làm sao biết đúng kiện khi xếp và giao?',
      answer:
        'Ở kho và lúc giao, mỗi kiện được đối chiếu bằng cách quét mã QR hoặc gõ mã in trên nhãn. Nhãn hỏng thì xác nhận tay kèm lý do, và điều phối viên duyệt xác nhận đó.',
    },
    loading3d: {
      chip: 'Phương án xếp hàng 3D gồm gì?',
      answer: 'Bạn xoay xem từng kiện trong thùng xe, tô theo màu điểm giao, rồi chỉnh tay trước khi duyệt.',
    },
    axle: {
      chip: 'Có kiểm tải trục không?',
      answer:
        'Có, khi xe đã khai vị trí và giới hạn của các trục. LoadMaster ước lượng tải trục trước và sau của phương án và báo rõ khi vượt giới hạn. Xe chưa khai trục thì không có số tải trục.',
    },
    routes: {
      chip: 'Có tối ưu tuyến đường không?',
      answer:
        'Có. Điều phối viên sắp thứ tự điểm giao bằng nút tối ưu tuyến và thấy giờ đến dự kiến của từng điểm so với hạn giao. Khi xe chạy, màn giám sát hiện vị trí xe trên bản đồ, tính lại giờ đến và cảnh báo điểm có nguy cơ trễ hạn.',
    },
    tenancy: {
      chip: 'Dữ liệu công ty tôi có tách riêng không?',
      answer:
        'Có. Tài khoản của một công ty chỉ thấy xe, kiện, chuyến, người dùng của công ty mình; quản trị công ty tạo tài khoản và giao vai trò cho nhân viên. Đội LoadMaster không mở được xe, kiện, chuyến của công ty — đội chỉ thấy tài khoản, gói, credit và yêu cầu hỗ trợ để hỗ trợ bạn.',
    },
    support: {
      chip: 'Cần hỗ trợ khi đang dùng thì sao?',
      answer: 'Người dùng của công ty mở mục "Yêu cầu hỗ trợ" trong menu tài khoản và trao đổi với đội hỗ trợ ngay trong ứng dụng.',
    },
    human: {
      chip: 'Tôi muốn hỏi người của LoadMaster',
      answer: 'Bạn gửi câu hỏi qua form liên hệ; đội LoadMaster đọc và trả lời qua email hoặc số điện thoại bạn để lại.',
    },
    about: {
      chip: 'Bạn là ai?',
      answer:
        'Mình là linh vật của LoadMaster, trả lời từ tài liệu của sản phẩm — không phải nhân viên tư vấn. Mình không ghi nhớ gì sau khi bạn tải lại trang. Câu nào chưa rõ, bạn gửi cho đội LoadMaster.',
    },
  },
  /** Phần trả lời dựng từ dữ liệu: danh mục gói, hằng của code. */
  facts: {
    loadingPlans: 'Đang tải danh mục gói…',
    planLine: '{name}: {price} mỗi tháng, {credits}',
    unlimited: 'không giới hạn credit',
    objectives: {
      one: 'Mỗi lần chạy tối ưu cho ra {count} phương án để so sánh:',
      other: 'Mỗi lần chạy tối ưu cho ra {count} phương án để so sánh:',
    },
    restRule: 'Giờ đến dự kiến đã gồm nghỉ bắt buộc {rest} phút sau mỗi {drive} giờ lái liên tục.',
    roleLine: '{role}: {device}',
    devices: {
      desktop: 'máy tính',
      desktopTablet: 'máy tính hoặc máy tính bảng',
      tablet: 'máy tính bảng tại kho',
      phone: 'điện thoại',
    },
  },
  /** Tính gói theo số lần chạy tối ưu mỗi tháng. */
  advisor: {
    quickLabel: 'Chọn nhanh số lần chạy mỗi tháng',
    quick: { one: '{count} lần mỗi tháng', other: '{count} lần mỗi tháng' },
    runsLabel: 'Số lần chạy mỗi tháng',
    submit: 'Tính gói',
    invalid: 'Nhập số nguyên từ 1 đến {max}.',
    math: {
      one: '{count} lần × {cost} credit mỗi lần = {credits} credit mỗi tháng.',
      other: '{count} lần × {cost} credit mỗi lần = {credits} credit mỗi tháng.',
    },
    pick: 'Gói rẻ nhất đủ dùng: {name} — {price} mỗi tháng, {credits}.',
    credits: '{count} credit mỗi tháng',
    caveat: 'Đây chỉ là ước tính theo số lần chạy bạn nhập.',
    none: 'Chưa có gói đang bán nào đủ {credits} credit mỗi tháng.',
  },
  /** Liên kết dưới câu trả lời. */
  actions: {
    label: 'Xem thêm',
    plans: 'Xem các gói',
    pricing: 'Mở bảng giá',
    how: 'Xem cách hoạt động',
    trial: 'Đăng ký trải nghiệm',
    registerNow: 'Đăng ký dùng ngay',
    requestTrial: 'Gửi yêu cầu dùng thử',
  },
  fallback: 'Mình chưa có câu trả lời cho câu này trong tài liệu của LoadMaster. Bạn chọn một câu hỏi bên dưới, hoặc gửi câu hỏi cho đội LoadMaster.',
  handoff: {
    ask: 'Gửi câu hỏi cho đội LoadMaster',
    notRight: 'Chưa đúng ý? Hỏi đội LoadMaster',
    /** Dòng đầu của nội dung form liên hệ khi khách chuyển câu hỏi từ trợ lý. */
    intro: 'Câu hỏi tôi đã hỏi trợ lý {name}:',
  },
} as const
