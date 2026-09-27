/**
 * Nguồn hàng (luồng 1 Review 1, LM-104): loại kiện `/loai-kien`, kiện đăng ký `/kien-hang`, in nhãn `/kien-hang/nhan`, lô hàng
 * `/lo-hang`, nhận hàng của logistics `/nhan-hang`. Trạng thái key trùng mã của kho (`REGISTERED_PACKAGE_STATUSES`, `SHIPMENT_STATUSES`,
 * `COMPANY_KINDS`).
 */
export const sourcing = {
  companyKinds: { manufacturer: 'Nhà sản xuất', logistics: 'Công ty logistics' },
  packageTypes: {
    title: 'Loại kiện',
    count: { one: '{count} loại kiện trong danh mục', other: '{count} loại kiện trong danh mục' },
    empty: 'Chưa có loại kiện nào.',
  },
  packages: {
    title: 'Kiện hàng',
    count: { one: '{count} kiện đã đăng ký', other: '{count} kiện đã đăng ký' },
    empty: 'Chưa có kiện nào được đăng ký.',
    status: {
      registered: 'Đã đăng ký',
      in_shipment: 'Đang giao cho logistics',
      received: 'Đã nhận ở kho',
      planned: 'Đã lên kế hoạch',
      loaded: 'Đã lên xe',
      delivered: 'Đã giao',
    },
  },
  labels: {
    title: 'In nhãn QR',
    count: { one: '{count} nhãn có thể in', other: '{count} nhãn có thể in' },
  },
  shipments: {
    title: 'Lô hàng',
    count: { one: '{count} lô hàng', other: '{count} lô hàng' },
    empty: 'Chưa có lô hàng nào.',
    detailCount: { one: '{count} kiện trong lô, đã nhận {received}', other: '{count} kiện trong lô, đã nhận {received}' },
    status: {
      draft: 'Nháp',
      handed_over: 'Đã bàn giao',
      partially_received: 'Đang nhận',
      received: 'Đã nhận đủ',
    },
  },
  receiving: {
    title: 'Nhận hàng',
    count: { one: '{count} kiện đang chờ quét nhận', other: '{count} kiện đang chờ quét nhận' },
    empty: 'Không có kiện nào đang chờ nhận.',
  },
} as const
