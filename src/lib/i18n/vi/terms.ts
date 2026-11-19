/**
 * Trang công khai "Điều khoản sử dụng" `/dieu-khoan-su-dung` (`features/marketing/terms`, khung chung ở nhánh `legal`). Mỗi câu nói đúng điều
 * ứng dụng hôm nay làm — không pháp nhân, địa chỉ, điều luật hay cam kết nào chưa có. Câu theo nguồn đang chạy (máy chủ hay bản demo) đứng
 * thành cặp, trang chọn một câu theo cấu hình. Số không viết vào câu: `{cost}`, `{days}`, `{percent}` (phần trăm) đọc từ `BILLING_CONSTANTS`, `{hours}`
 * và `{purgeDays}` từ `legal/legal-facts.ts`; `{roles}` là tên các vai trò, `{provisional}` là nhãn `common.provisionalPlan`.
 */
export const terms = {
  title: 'Điều khoản sử dụng',
  lede: 'Điều kiện để công ty của bạn và từng người dùng làm việc trên LoadMaster: tài khoản, dùng thử, gói cước và credit, và trách nhiệm khi dùng kết quả tối ưu.',
  summary: {
    account: 'Tài khoản thuộc về công ty: quản trị công ty tạo và quản lý tài khoản của nhân viên, mỗi người làm đúng việc của vai trò mình.',
    credit: 'Một lần chạy tối ưu xếp hàng 3D dùng {cost} credit; credit còn thừa không cộng dồn sang kỳ sau.',
    results: 'Phương án xếp hàng và giờ đến là ước lượng để tham khảo: kiểm tra tải trọng, chằng buộc và an toàn trước khi xe chạy là việc của bạn.',
    data: 'Dữ liệu vận hành của mỗi công ty tách riêng và thuộc về công ty đó.',
    cancel: 'Huỷ gói thì gói không gia hạn nữa, nhưng vẫn dùng được tới hết kỳ đã trả.',
  },
  scope: {
    title: 'Phạm vi dịch vụ',
    body: 'LoadMaster là phần mềm chạy trên trình duyệt, giúp doanh nghiệp vận tải vừa và nhỏ lập kế hoạch chuyến hàng và xếp hàng lên xe. Dịch vụ gồm:',
    items: {
      plan: 'lập yêu cầu giao, lập chuyến và tối ưu thứ tự điểm giao;',
      optimize: 'tối ưu xếp hàng 3D: mỗi lần chạy cho ba phương án để điều phối viên xem, chỉnh tay và duyệt;',
      operate: 'kho xếp hàng và tài xế giao hàng theo phương án đã duyệt, đối chiếu từng kiện bằng mã QR;',
      monitor: 'giám sát chuyến đang chạy, báo cáo chuyến, bảng điều khiển và bảng lương tài xế.',
    },
    agree: 'Các điều khoản này áp dụng cho công ty dùng LoadMaster và mọi người dùng tài khoản của công ty đó. Dùng ứng dụng nghĩa là bạn đồng ý với chúng.',
    availability: 'Chức năng nào chưa có ở bản bạn đang mở thì không hiện trên màn; các điều khoản dưới đây nói theo đúng bản đó.',
  },
  account: {
    title: 'Tài khoản và vai trò',
    company: 'Mỗi tài khoản thuộc một công ty và mang một vai trò: {roles}. Mỗi vai trò chỉ thấy và làm những việc của vai trò đó.',
    admin: 'Quản trị công ty tạo, sửa, khoá và xoá tài khoản của nhân viên công ty mình. Tài khoản quản trị công ty đầu tiên do đội LoadMaster tạo khi mở công ty.',
    adminSelf: 'Quản trị công ty tạo, sửa, khoá và xoá tài khoản của nhân viên công ty mình. Tài khoản quản trị công ty đầu tiên được tạo khi đăng ký dùng thử được duyệt, khi đăng ký trả phí đã thanh toán, hoặc khi đội LoadMaster mở công ty.',
    password: 'Bạn giữ mật khẩu cho riêng mình và không dùng chung tài khoản. Nghi mật khẩu bị lộ thì đổi ngay và báo quản trị công ty của bạn.',
    responsible: 'Công ty chịu trách nhiệm về những việc làm bằng tài khoản của mình; ứng dụng ghi nhật ký ai làm gì, lúc nào.',
  },
  trial: {
    title: 'Dùng thử',
    request: 'Đăng ký dùng thử là dùng thử gói Basic. Máy chủ kiểm sơ bộ thông tin, rồi đội LoadMaster duyệt và đặt thời gian dùng thử; thời gian đó hiện ở trang gói cước của công ty.',
    agreement: 'Quản trị công ty phải ký thoả thuận dịch vụ thử nghiệm ngay trong ứng dụng trong {hours} giờ kể từ khi tài khoản được cấp. Quá hạn mà chưa ký thì tài khoản công ty bị khoá chức năng, kể cả khi thời gian dùng thử vẫn còn; quản trị công ty ký thoả thuận hoặc gửi yêu cầu mở khoá để dùng tiếp.',
    purge: 'Tài khoản dùng thử bị khoá vì chưa ký thoả thuận thì bị xoá hẳn {purgeDays} ngày sau khi hết hạn dùng thử.',
    after: 'Hết thời gian dùng thử, công ty cần đăng ký một gói cước để dùng tiếp.',
    off: 'Bản này chưa mở đăng ký dùng thử công khai: tài khoản công ty do đội LoadMaster tạo sau khi nhận yêu cầu liên hệ.',
  },
  billing: {
    title: 'Gói cước, credit, gia hạn và huỷ',
    plans: 'Mỗi gói có giá mỗi kỳ, số credit mỗi tháng và hạng tối ưu; danh mục đang bán ở trang Bảng giá. Gói mang nhãn "{provisional}" là giá chưa chốt và có thể đổi. Giá và credit mới của một gói chỉ áp dụng từ kỳ gia hạn kế tiếp của từng công ty.',
    pricingLink: 'Xem Bảng giá',
    period: 'Một kỳ gói dài {days} ngày. Đầu mỗi kỳ, số dư credit được đặt lại về đúng số credit tháng của gói: credit còn thừa, kể cả credit đã mua thêm, không cộng dồn sang kỳ sau.',
    cost: 'Một lần chạy tối ưu xếp hàng 3D dùng {cost} credit, kể cả khi lần chạy đó cho ra ba phương án. Lần chạy không ra kết quả thì không bị trừ credit. Gói không giới hạn credit thì không trừ.',
    topUp: 'Quản trị công ty nạp thêm credit ở trang "Gói và credit" khi gói còn hiệu lực, và được báo "Sắp hết credit" khi số dư xuống tới {percent}% credit tháng của gói.',
    renew: 'Gói được gia hạn khi quản trị công ty thanh toán cho kỳ kế tiếp; tới hạn mà chưa thanh toán thì gói hết hạn.',
    cancel: 'Huỷ gói thì gói không gia hạn nữa, nhưng vẫn dùng được tới hết kỳ đã trả.',
    expiredServer: 'Công ty không còn gói đang hiệu lực thì nhân viên của công ty không dùng được ứng dụng; quản trị công ty chỉ còn trang "Gói và credit" để gia hạn hoặc đăng ký gói.',
    expiredDemo: 'Ở bản demo này, gói đã hết hạn vẫn dùng được số credit còn lại nhưng chỉ ở hạng tối ưu Cơ bản, và không nạp thêm được tới khi gia hạn.',
    payment: 'Thanh toán đi qua trang thanh toán của ứng dụng hoặc trang của cổng thanh toán; ứng dụng không có ô nhập số thẻ hay tài khoản ngân hàng. Phí gói đã thanh toán không hoàn lại, trừ trường hợp lỗi kỹ thuật từ phía LoadMaster.',
    paymentDemo: 'Bản demo này dùng thanh toán giả lập: không có khoản tiền thật nào được thu.',
  },
  results: {
    title: 'Kết quả tối ưu là ước lượng',
    estimate: 'Phương án xếp hàng, tải trục, trọng tâm hàng và giờ đến dự kiến được tính từ dữ liệu công ty nhập — kích thước, khối lượng, xe, toạ độ. Chúng là ước lượng để tham khảo, không phải phép đo trên xe thật.',
    checkIntro: 'Trước khi xe chạy, công ty và người phụ trách tự kiểm tra và chịu trách nhiệm về:',
    check: {
      load: 'tải trọng và tải trục thực tế của xe;',
      securing: 'chằng buộc, chèn lót và độ vững của hàng;',
      safety: 'an toàn của hàng, người và phương tiện, và các quy định về vận tải đường bộ.',
    },
    input: 'Dữ liệu sai thì kết quả sai: ứng dụng không cân, không đo hàng thật. Giờ đến dự kiến không biết trước tắc đường, thời tiết hay sự cố trên đường.',
    approval: 'Ứng dụng chặn duyệt khi phương án vượt tải trục hoặc còn kiện bắt buộc chưa xếp, nhưng việc chặn đó không thay cho kiểm tra thực tế. Người duyệt phương án xem lại các cảnh báo trước khi duyệt.',
    mock: 'Kết quả mang nhãn MOCK RESULT là của bộ tối ưu mô phỏng.',
  },
  data: {
    title: 'Dữ liệu của công ty',
    owner: 'Dữ liệu vận hành công ty nhập vào — xe, kiện hàng, khách gửi hàng, nơi nhận, chuyến, phương án, bảng lương — thuộc về công ty đó. Công ty chịu trách nhiệm về tính đúng của dữ liệu và về quyền dùng thông tin của khách và nhân viên mà mình nhập.',
    tenancy: 'Dữ liệu tách riêng theo công ty: tài khoản của công ty này không đọc được dữ liệu của công ty khác, và đội LoadMaster không mở được xe, kiện, chuyến của công ty nào.',
    privacy: 'LoadMaster thu, dùng và lưu dữ liệu đúng như Chính sách bảo mật nói.',
    privacyLink: 'Đọc Chính sách bảo mật',
  },
  conduct: {
    title: 'Những việc không được làm',
    intro: 'Khi dùng LoadMaster, bạn không được:',
    items: {
      share: 'dùng tài khoản của người khác, hoặc cho người ngoài công ty dùng tài khoản của bạn;',
      access: 'tìm cách đọc dữ liệu của công ty khác hoặc làm việc vượt quyền của vai trò mình;',
      attack: 'dò quét, tấn công hay làm quá tải hệ thống, kể cả gửi tự động hàng loạt qua form;',
      content: 'nhập dữ liệu bạn không có quyền dùng, hoặc nội dung trái pháp luật;',
      copy: 'sao chép, dịch ngược hoặc bán lại phần mềm LoadMaster.',
    },
  },
  termination: {
    title: 'Tạm ngừng và chấm dứt',
    company: 'Quản trị công ty khoá hoặc xoá tài khoản của nhân viên công ty mình bất cứ lúc nào.',
    platform: 'Đội LoadMaster có thể khoá tài khoản hoặc tạm dừng công ty vi phạm các điều khoản này.',
    plan: 'Công ty hết gói đang hiệu lực, hay tài khoản dùng thử quá hạn ký thoả thuận, bị khoá như mục "Gói cước, credit, gia hạn và huỷ" và mục "Dùng thử" nói.',
    leave: 'Muốn ngừng dùng LoadMaster, quản trị công ty huỷ gói (gói vẫn dùng được tới hết kỳ) và, nếu muốn xoá dữ liệu của công ty, gửi yêu cầu qua form liên hệ.',
  },
  liability: {
    title: 'Giới hạn trách nhiệm',
    asIs: 'LoadMaster được cung cấp theo hiện trạng. Đội LoadMaster cố gắng giữ dịch vụ chạy ổn định nhưng không bảo đảm dịch vụ không bao giờ gián đoạn hay có lỗi.',
    limits: 'Trong phạm vi pháp luật cho phép, LoadMaster không chịu trách nhiệm về thiệt hại phát sinh từ việc dùng kết quả tối ưu mà không kiểm tra thực tế, từ dữ liệu sai do người dùng nhập, hay từ việc tài khoản bị người khác dùng vì lộ mật khẩu.',
  },
  changes: {
    title: 'Thay đổi điều khoản',
    body: 'Khi điều khoản đổi, trang này được sửa và ngày cập nhật ở đầu trang đổi theo. Bản đang hiện là bản đang áp dụng; tiếp tục dùng ứng dụng sau khi điều khoản đổi nghĩa là bạn đồng ý với bản mới.',
  },
  contact: {
    title: 'Liên hệ',
    guest: 'Câu hỏi về các điều khoản này, hãy gửi qua form liên hệ ở trang giới thiệu.',
    user: 'Đã có tài khoản công ty thì mở "Yêu cầu hỗ trợ" trong menu tài khoản của ứng dụng để hỏi đội hỗ trợ.',
  },
} as const
