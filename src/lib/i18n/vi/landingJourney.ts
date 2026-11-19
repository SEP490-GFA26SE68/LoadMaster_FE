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
  lede: 'Năm chặng, bốn vai trò, cùng một phương án đã duyệt. Cuộn xuống để xem thùng xe đi qua từng chặng.',
  /** Tên truy cập của danh sách năm chặng. */
  chaptersLabel: 'Năm chặng của một chuyến hàng',
  chapters: {
    plan: {
      title: 'Lập chuyến và chọn phương án',
      text: 'Điều phối viên đưa yêu cầu giao vào chuyến, tối ưu thứ tự điểm giao rồi chạy tối ưu xếp hàng 3D. Một lần chạy cho ba phương án; so cạnh nhau, chỉnh tay nếu cần rồi duyệt một.',
    },
    load: {
      title: 'Soạn và xếp ở kho',
      text: 'Nhân viên kho soạn hàng rồi xếp theo thứ tự của phương án đã duyệt: hàng của điểm giao cuối vào trước, nằm sâu nhất. Mỗi kiện phải đối chiếu mới tính là đã xếp.',
    },
    road: {
      title: 'Trên đường',
      text: 'Xe đi theo thứ tự điểm đã tối ưu. Điều phối viên theo dõi vị trí xe và giờ đến dự kiến so với hạn giao, xử lý sự cố khi xe gặp chuyện trên đường.',
    },
    stop: {
      title: 'Tại điểm giao',
      text: 'Hàng của điểm đang giao nằm sát cửa. Tài xế dỡ từng kiện qua hộp đối chiếu; kiện khách từ chối ở lại xe và thành hoàn trả khi hoàn tất điểm.',
    },
    done: {
      title: 'Giao xong, báo cáo và tính lương',
      text: 'Giao xong điểm cuối, chuyến thành Đã giao. Báo cáo chuyến ghi giờ đến thật so với hạn từng điểm; quản lý công ty xem bảng điều khiển và chốt bảng lương tài xế theo tháng.',
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
    source: 'Số của lần chạy mẫu {count} kiện mà bộ tối ưu mô phỏng vừa tính trên trình duyệt của bạn — cùng lần chạy với khung 3D ở đầu trang. "Tốt nhất" so trong ba phương án, không phải điểm chuẩn.',
    pending: 'Đang tính lần chạy mẫu…',
    off: 'Trình duyệt này không chạy bộ tối ưu mẫu (đang tiết kiệm dữ liệu hoặc thiếu Web Worker), nên bảng không có số.',
    error: 'Lần chạy mẫu không tính được trên trình duyệt này, nên bảng không có số.',
  },
  /** Hai số cố định của lần chạy tối ưu, mỗi số một câu nguồn. */
  facts: {
    credit: {
      value: { one: '{count} credit', other: '{count} credit' },
      label: 'cho một lần chạy, cả ba phương án',
      source: 'Hằng số của ứng dụng. Tối ưu thứ tự điểm giao không tốn credit.',
    },
    speed: {
      value: '< {seconds} giây',
      label: 'cho {count} kiện, đủ ba phương án',
      source: 'Ngưỡng của bài đo hiệu năng tự động cho bộ tối ưu mô phỏng, đo trên máy phát triển — máy khác có thể khác.',
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
    source: 'Đếm trên phương án {label} của lần chạy mẫu ở đầu trang.',
  },
  /** Phiếu lương minh hoạ của chặng cuối: nhãn của màn Bảng lương, không số nào. */
  payslip: {
    title: 'Phiếu lương tài xế',
    note: 'Hoa hồng và tiền bốc dỡ tính theo khối lượng hàng của các chuyến đã giao trong tháng, theo đơn giá của công ty.',
  },
} as const
