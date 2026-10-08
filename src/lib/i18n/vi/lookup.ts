/**
 * Màn Tra cứu kiện `/tra-cuu-kien` (FE-3b-06, D-63, D-92): điều phối viên và nhân viên kho quét hoặc gõ mã để xem một kiện của kho
 * kiện. Nhãn trạng thái, cờ và loại hàng lấy ở nhánh `common`; mã lỗi của kho ở `dataErrors`.
 */
export const lookup = {
  title: 'Tra cứu kiện',
  backToWarehouse: 'Về màn kho',
  scan: 'Quét mã QR',
  scanTitle: 'Quét mã QR của kiện',
  scanDescription: 'Đưa nhãn dán trên kiện vào khung hình, hoặc nhập mã in dưới hình QR.',
  codeLabel: 'Mã QR hoặc mã kiện của bên gửi',
  codePlaceholder: 'VD: LM-7K3F-9XQ2-M4TD hoặc HK-DNG-2609-01',
  codeHint: 'Gõ đủ cả mã như in trên nhãn; chữ hoa hay thường đều được.',
  codeRequired: 'Nhập mã trước khi tra cứu.',
  submit: 'Tra cứu',
  loading: 'Đang tra cứu',
  idle: {
    title: 'Quét hoặc nhập mã để xem kiện',
    description: 'Mã QR và mã của bên gửi đều in trên nhãn dán ở kiện.',
  },
  notFound: {
    title: 'Không tìm thấy',
    description: 'Không có kiện nào của công ty bạn mang mã {code}. Xem lại mã in trên nhãn.',
  },
  many: {
    title: { one: '{count} kiện mang mã {code}', other: '{count} kiện mang mã {code}' },
    hint: 'Chọn đúng kiện theo điểm đến và chuyến.',
    choose: 'Xem kiện {id}',
    back: 'Về danh sách kiện cùng mã',
  },
  result: 'Kiện {code}',
  fields: {
    poolId: 'Mã của kho kiện',
    senderCode: 'Mã của bên gửi',
    qrToken: 'Mã QR',
    dimensions: 'Kích thước (D × R × C)',
    weight: 'Khối lượng',
    handlingClass: 'Loại hàng',
    destination: 'Điểm đến',
    flags: 'Cờ',
    noFlags: 'Không có cờ',
    trip: 'Chuyến',
    stop: 'Điểm giao',
    stopValue: 'Điểm {number} · {name}',
    notInTrip: 'Chưa vào chuyến nào',
  },
  reprint: 'In lại nhãn',
  openInPool: 'Mở trong Kho kiện',
  flagNote: 'Kiện mang cờ chưa đưa vào yêu cầu giao hay chuyến được.',
  flagCleared: 'Đã gỡ cờ {flag} của kiện {code}.',
  found: {
    prompt: 'Kiện này đang mang cờ "Không tìm thấy". Nếu kiện đang ở trước mặt bạn, xác nhận để gỡ cờ.',
    confirm: 'Đã tìm thấy kiện này',
    done: 'Đã gỡ cờ "Không tìm thấy" của kiện {code}. Điều phối viên thấy việc này ở chuông thông báo.',
  },
} as const
