/**
 * Phần "Một chuyến, bốn màn" của trang giới thiệu (`#vai-tro`, `features/marketing/roles`): bốn vai trò của một chuyến, mỗi vai trò một
 * tab có hình thiết bị vẽ lại màn thật của ứng dụng và hai ý về việc người đó làm. Chữ trong hình lấy lại từ nhánh của chính màn đó
 * (`monitoring`, `warehouse`, `driver`, `trips.routePlan`, `common.deadlineStatuses`, `status`) khi có; nhánh này chỉ thêm chữ riêng của
 * phần. Hình là minh hoạ (`aria-hidden`): `text` là bản chữ tương đương cho trình đọc màn hình. Số trong hình tính từ chuyến mẫu của trang
 * và tuyến mẫu của phần này (`roles-sample.mock.ts`) — câu nguồn ở `source`. Không nhãn MOCK RESULT trên trang công khai.
 */
export const landingRoles = {
  title: 'Một chuyến, bốn màn',
  lede: 'Cùng một chuyến, mỗi người một màn.',
  /** Tên truy cập của nhóm tab. */
  tabsLabel: 'Vai trò trong một chuyến',
  /** Dòng trên hai ý của tab: tên màn và thiết bị. */
  screens: {
    dispatcher: 'Màn Giám sát, trên máy tính',
    warehouse: 'Màn xếp hàng, trên máy tính bảng ở kho',
    driver: 'Màn điểm giao, trên điện thoại',
    companyManager: 'Bảng điều khiển, trên máy tính',
  },
  points: {
    dispatcher: {
      p1: 'Xe đang ở đâu, đang tới điểm nào — vị trí ghi rõ là GPS hay mô phỏng.',
      p2: 'Giờ đến dự kiến đặt cạnh hạn giao của từng điểm, đã tính giờ nghỉ bắt buộc của tài xế.',
    },
    warehouse: {
      p1: 'Mỗi màn một kiện: kiện nào, vào vùng của điểm giao nào trong thùng.',
      p2: 'Kiện phải đối chiếu — quét mã, gõ mã hoặc xác nhận tay — mới tính là đã xếp.',
    },
    driver: {
      p1: 'Điểm đang tới, giờ đến dự kiến và hạn giao; mỗi bước một nút chính.',
      p2: 'Dỡ từng kiện qua hộp đối chiếu; kiện khách từ chối ở lại xe.',
    },
    companyManager: {
      p1: 'Số liệu các chuyến theo kỳ, mỗi số kèm nguồn, xuất được báo cáo.',
      p2: 'Xem chuyến và phương án ở chế độ chỉ đọc, chốt bảng lương tài xế theo tháng.',
    },
  },
  /** Một câu chữ, không huy hiệu tải, không liên kết cửa hàng: ứng dụng di động chưa phát hành trên cửa hàng ứng dụng. */
  mobileApp: 'Tài xế và nhân viên kho còn có ứng dụng di động riêng — chưa lên cửa hàng ứng dụng.',
  source: 'Số trong hình tính từ chuyến mẫu {count} kiện; giờ đến theo đường nối thẳng, xe rời kho lúc {time}.',
  /** Chữ riêng trong hình (phần còn lại lấy từ nhánh của màn thật). */
  frame: {
    trip: 'Chuyến mẫu',
    headingTo: 'Đang tới điểm {number}',
    stopTimes: 'Dự kiến {eta} · hạn {deadline}',
    depot: 'Kho',
    loaded: 'Đã xếp',
    front: 'Đầu xe',
    rearDoor: 'Cửa sau',
    toUnload: { one: 'Cần dỡ {count} kiện', other: 'Cần dỡ {count} kiện' },
    kpi: {
      packages: 'Kiện',
      stops: 'Điểm giao',
      weight: 'Khối lượng hàng',
      payload: 'Tải trọng đã dùng',
    },
    chart: 'Khối lượng theo điểm giao',
  },
  /** Bản chữ tương đương của từng hình, cho trình đọc màn hình. */
  text: {
    dispatcher: 'Hình minh hoạ màn Giám sát: sơ đồ tuyến từ kho qua {count} điểm giao, xe đang tới điểm {number}, vị trí xe là vị trí mô phỏng. Cả tuyến {summary}.',
    stop: 'Điểm {number} · {name}: dự kiến {eta}, hạn giao {deadline} — {status}.',
    warehouse: 'Hình minh hoạ màn xếp hàng: đã xếp {loaded} / {total} kiện. Kiện cần xếp là {id}, {size}, {weight}, vào vùng của điểm {number} · {name}, {place}. Nút của bước là "{action}".',
    driver: 'Hình minh hoạ màn điểm giao: điểm {number} / {total} · {name}, dự kiến đến {eta}, hạn giao {deadline} — {status}. Cần dỡ {count} kiện. Nút của bước là "{action}".',
    companyManager: 'Hình minh hoạ bảng điều khiển: {packages} kiện, {stops} điểm giao, {weight} hàng, bằng {percent} tải trọng xe. Khối lượng theo điểm giao:',
    stopWeight: 'Điểm {number} · {name}: {weight}.',
  },
} as const
