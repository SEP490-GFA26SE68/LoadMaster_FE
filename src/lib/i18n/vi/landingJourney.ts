/**
 * Hai phần giữa của trang giới thiệu: dải "Ba chuyện quen thuộc" trong khối tối mở đầu (`LandingProblems`) và "Một chuyến hàng trên
 * LoadMaster" (`#cach-hoat-dong`, `LandingJourney`) — năm chặng của một chuyến, mỗi chặng một vai trò, cạnh hình thùng xe dính theo
 * cuộn. Số trong phần này có nguồn: lần chạy mẫu của bộ tối ưu mô phỏng trên trình duyệt, hằng số trong code, hoặc ngưỡng của bài đo
 * tự động; câu nguồn đi cùng số. Không nhãn MOCK RESULT trên trang công khai.
 */
export const landingJourney = {
  problems: {
    title: 'Ba chuyện quen thuộc của một chuyến hàng',
    lede: 'Những việc nhỏ làm chậm cả chuyến — và cách LoadMaster xử lý từ lúc lập kế hoạch.',
    buried: {
      problem: 'Tới điểm 2, hàng của điểm 2 nằm tít trong thùng.',
      answer: 'Hàng được xếp theo thứ tự giao: điểm cuối nằm sâu nhất, điểm đầu sát cửa.',
    },
    axle: {
      problem: 'Thùng còn chỗ, nhưng không ai biết trục sau đã quá tải.',
      answer: 'Tải trục trước và sau hiện cạnh giới hạn của xe; vượt giới hạn thì phương án không duyệt được.',
    },
    wrong: {
      problem: 'Kiện lên nhầm xe, hay xuống nhầm điểm.',
      answer: 'Mỗi kiện được đối chiếu khi soạn, khi xếp và khi dỡ — quét mã, gõ mã hoặc xác nhận tay.',
    },
  },
  title: 'Một chuyến hàng trên LoadMaster',
  lede: 'Năm chặng, một phương án đã duyệt.',
  /** Tên truy cập của danh sách năm chặng. */
  chaptersLabel: 'Năm chặng của một chuyến hàng',
  chapters: {
    plan: {
      title: 'Lập chuyến và chọn phương án',
      text: 'Tối ưu thứ tự điểm rồi xếp hàng 3D: một lần chạy ra ba phương án để so và duyệt.',
    },
    load: {
      title: 'Soạn và xếp ở kho',
      text: 'Hàng của điểm cuối vào trước, nằm sâu nhất; kiện phải đối chiếu mới tính là đã xếp.',
    },
    road: {
      title: 'Trên đường',
      text: 'Theo dõi vị trí xe, giờ đến dự kiến so với hạn từng điểm và xử lý sự cố trên đường.',
    },
    stop: {
      title: 'Tại điểm giao',
      text: 'Hàng của điểm đang giao nằm sát cửa; tài xế dỡ từng kiện qua hộp đối chiếu.',
    },
    done: {
      title: 'Giao xong, báo cáo và tính lương',
      text: 'Báo cáo ghi giờ đến thật so với hạn; quản lý xem số liệu và chốt bảng lương tài xế.',
    },
  },
  /** Hình thùng xe dính theo cuộn: chỉ là hình (trình đọc màn hình đọc chữ của từng chặng). */
  truck: {
    door: 'Cửa sau',
  },
  /** Bảng so ba phương án của chặng điều phối: số của lần chạy mẫu, cùng lần chạy với khung 3D ở phần mở đầu. */
  plans: {
    caption: 'So sánh ba phương án của lần chạy mẫu',
    metric: 'Chỉ số',
    source: 'Số của lần chạy mẫu {count} kiện trên trình duyệt này; "Tốt nhất" chỉ so ba phương án.',
    pending: 'Đang tính lần chạy mẫu…',
    off: 'Trình duyệt này không chạy bộ tối ưu mẫu (đang tiết kiệm dữ liệu hoặc thiếu Web Worker), nên bảng không có số.',
    error: 'Lần chạy mẫu không tính được trên trình duyệt này, nên bảng không có số.',
  },
  /** Hai số cố định của lần chạy tối ưu, mỗi số một câu nguồn. */
  facts: {
    credit: {
      value: { one: '{count} credit', other: '{count} credit' },
      label: 'mỗi lần chạy',
      source: 'Hằng số của ứng dụng.',
    },
    speed: {
      value: '< {seconds} giây',
      label: 'cho {count} kiện',
      source: 'Ngưỡng bài đo trên máy phát triển.',
    },
  },
  verify: {
    label: 'Ba cách đối chiếu một kiện',
    levels: {
      qr: 'Quét mã QR',
      code: 'Gõ mã kiện',
      manual: 'Xác nhận tay, chờ điều phối viên duyệt',
    },
  },
  route: {
    depot: 'Kho',
    /** Ba mức hạn là chú giải, cùng chữ và màu như Chi tiết chuyến — không phải giờ đến của chuyến nào. */
    deadlines: 'Mức hạn của mỗi điểm giao',
  },
  stop: {
    source: 'Đếm trên phương án {label} của lần chạy mẫu.',
  },
  /** Phiếu lương minh hoạ của chặng cuối: nhãn của màn Bảng lương, không số nào. */
  payslip: {
    title: 'Phiếu lương tài xế',
    note: 'Hoa hồng và tiền bốc dỡ tính theo khối lượng đã giao trong tháng.',
  },
} as const
