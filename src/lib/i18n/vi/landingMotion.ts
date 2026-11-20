/**
 * Chữ của các chuyển động trên trang giới thiệu: lời Lumo nói, dòng mở của dải nguyên tắc xếp hàng và dải chữ trôi theo cuộn dưới nó
 * (việc sản phẩm làm thật trong một chuyến — không số, không lời khen).
 */
export const landingMotion = {
  /** Lời của Lumo (`LumoSays`): mỗi câu một ý, không số — số nằm ở nội dung của phần, kèm câu nguồn của nó. */
  lumo: {
    /** Chỉ trình đọc màn hình đọc, đứng trước câu Lumo nói; `{name}` là tên riêng của linh vật. */
    says: '{name} nói:',
  },
  statement: {
    kicker: 'Nguyên tắc xếp hàng',
  },
  ribbon: {
    label: 'Việc LoadMaster lo trong một chuyến',
    plan3d: 'Xếp 3D theo thứ tự dỡ',
    qr: 'Đối chiếu từng kiện bằng mã QR',
    route: 'Tối ưu tuyến, tính giờ đến',
    approve: 'Duyệt phương án trước khi xếp',
    axle: 'Ước lượng tải trục trước và sau',
    monitor: 'Giám sát chuyến đang chạy',
    report: 'Báo cáo sau mỗi chuyến',
  },
} as const
