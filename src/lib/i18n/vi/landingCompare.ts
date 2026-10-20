/**
 * Mục so với cách làm hiện tại của trang giới thiệu (`LandingCompare`, neo `#so-sanh`): bảng so từng việc của một chuyến hàng, rồi phù hợp
 * với ai, cần chuẩn bị gì và điều chưa có. Mỗi câu ở cột LoadMaster là việc ứng dụng làm được thật (AGENTS mục 1, 5b, 7, 9); không con số
 * nào. Cột của file kiện mẫu lấy tên từ `sourcing.import.header` theo `IMPORT_COLUMNS` của kho kiện.
 */
export const landingCompare = {
  title: 'So với cách làm hiện tại',
  lede: 'Cùng những việc của một chuyến hàng: làm bằng bảng tính và ước lượng bằng mắt, hay làm trên một phương án mà điều phối viên, kho và tài xế cùng theo.',
  table: {
    caption: 'Bảng tính và LoadMaster, theo từng việc của một chuyến hàng',
    job: 'Việc',
    manual: 'Bảng tính và ước lượng bằng mắt',
    app: 'Với LoadMaster',
  },
  rows: {
    plan: {
      job: 'Lập phương án xếp',
      manual: 'Cộng thể tích trên bảng tính, ước lượng bằng mắt; có vừa thùng hay không chỉ biết khi kho xếp thử.',
      app: 'Một lần chạy tối ưu cho ba phương án 3D theo ba mục tiêu: tối đa thể tích, cân bằng tải trục, ít dỡ-xếp lại. So sánh, chỉnh tay rồi duyệt một.',
    },
    axle: {
      job: 'Kiểm tra tải trục và trọng tâm',
      manual: 'Thường chỉ so tổng khối lượng với tải trọng xe; hàng dồn về một đầu thùng khó thấy trước khi xe chạy.',
      app: 'Tính tải trục trước, trục sau theo dữ liệu trục khai cho từng xe và cảnh báo trọng tâm hàng lệch. Phương án vượt giới hạn trục không duyệt được.',
    },
    unload: {
      job: 'Thứ tự dỡ theo điểm giao',
      manual: 'Nhớ trong đầu kiện nào xuống trước; hàng của điểm sau chắn cửa thì phải dỡ ra rồi xếp lại.',
      app: 'Thùng chia vùng theo điểm giao: hàng của điểm cuối nằm sâu nhất, hàng của điểm đầu sát cửa. Kiện chắn lối dỡ và kiện nằm ngoài vùng được đánh dấu, số lần dỡ-xếp lại được đếm.',
    },
    verify: {
      job: 'Đối chiếu kiện khi soạn, xếp, giao',
      manual: 'Đếm tay theo phiếu in; sót hay nhầm kiện thì khó truy lại ai làm, lúc nào.',
      app: 'Mỗi kiện được đối chiếu khi soạn, xếp và dỡ: quét mã QR, gõ mã, hoặc xác nhận tay chờ điều phối viên duyệt. Mỗi lần ghi lại người làm và thời điểm.',
    },
    track: {
      job: 'Theo dõi chuyến và giờ đến dự kiến',
      manual: 'Gọi điện hỏi tài xế đang ở đâu rồi tự tính giờ đến.',
      app: 'Vị trí xe trên bản đồ, giờ đến dự kiến của từng điểm so với hạn giao, cảnh báo nguy cơ trễ hạn và sự cố trên đường.',
    },
    report: {
      job: 'Báo cáo chuyến',
      manual: 'Gom lại từ phiếu giao, tin nhắn và ghi chép sau khi chuyến xong.',
      app: 'Báo cáo của từng chuyến: giờ đến so với hạn ở mỗi điểm, kiện hoàn trả, cách đối chiếu kiện, sự cố. Quản lý xem bảng điều khiển và xuất báo cáo .xlsx.',
    },
  },
  fit: {
    title: 'Phù hợp với',
    items: {
      fleet: 'Doanh nghiệp vận tải vừa và nhỏ chở hàng kiện, hàng thùng tới nhiều điểm giao trong một chuyến.',
      team: 'Đội có điều phối viên lập chuyến, nhân viên kho soạn và xếp hàng, tài xế giao theo từng điểm.',
      cargo: 'Hàng cần giữ thứ tự dỡ, giữ đứng hay hạn chế xếp chồng; hàng dễ vỡ, hàng lạnh, hàng nguy hiểm cần tách chuyến theo loại.',
    },
  },
  prepare: {
    title: 'Cần chuẩn bị',
    vehicles: {
      title: 'Danh sách xe',
      text: 'Kích thước lòng thùng, cửa sau, tải trọng; vị trí, tải khi rỗng và giới hạn của từng trục; vật cản trong thùng như hốc bánh, dàn lạnh.',
    },
    packages: {
      title: 'Danh sách kiện',
      text: 'File .xlsx theo mẫu, mỗi kiện một dòng, với các cột:',
      /** Tên cột lấy từ tiêu đề của file mẫu (`sourcing.import.header`). */
      columns: 'Cột của file kiện mẫu',
      optional: '{column} (tuỳ chọn)',
    },
    stops: {
      title: 'Điểm giao',
      text: 'Địa chỉ và toạ độ của từng điểm để tối ưu tuyến; hạn giao nếu có.',
    },
    people: {
      title: 'Người dùng và thiết bị',
      text: 'Tài khoản cho điều phối viên, nhân viên kho, tài xế; máy tính cho điều phối, máy tính bảng ở kho, điện thoại cho tài xế, máy in khổ A4 cho nhãn QR.',
    },
  },
  /** Điều chưa có, nói thẳng: chỉ ghi điều đã kiểm là không có trong ứng dụng. */
  missing: {
    title: 'Chưa có',
    text: 'Kết nối sẵn với phần mềm kế toán hay ERP. Kiện vào hệ thống bằng file .xlsx hoặc thêm tay.',
  },
} as const
