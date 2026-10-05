/**
 * Mã QR của kiện (LM-104): `components/QrCode.tsx`, hộp thoại quét `components/QrScanDialog.tsx`, chữ trên nhãn in của kiện
 * (`label`, FE-3b-05 — `package-pool/PackageLabel.tsx`) và hộp đối chiếu kiện ba mức `components/PackageVerify.tsx` (`verify`,
 * FE-6-03 — tên ba mức và lý do xác nhận tay nằm ở nhánh `common`).
 */
export const qr = {
  imageLabel: 'Mã QR {token}',
  label: {
    poolId: 'Mã kho kiện',
    senderCode: 'Mã bên gửi',
    handlingClass: 'Loại hàng',
    dimensions: 'Kích thước',
    weight: 'Khối lượng',
    destination: 'Điểm đến',
    fragile: 'Hàng dễ vỡ',
  },
  scan: {
    camera: {
      starting: 'Đang mở camera…',
      scanning: 'Camera đang quét. Đưa mã QR vào giữa khung hình.',
      unsupported: 'Trình duyệt này không quét được mã QR bằng camera. Hãy gõ mã in dưới hình QR.',
      denied: 'Chưa được phép dùng camera. Hãy gõ mã in dưới hình QR.',
      failed: 'Không mở được camera. Hãy gõ mã in dưới hình QR.',
    },
    manualLabel: 'Nhập mã',
    manualHint: 'Mã in ngay dưới hình QR. Chữ hoa hay thường, có khoảng trắng đều được.',
    manualRequired: 'Nhập mã trước khi xác nhận.',
    submit: 'Xác nhận mã',
    close: 'Đóng',
  },
  /** Hộp đối chiếu kiện ba mức (FE-6-03, D-83): quét QR → gõ mã → xác nhận tay chờ điều phối viên duyệt. */
  verify: {
    levels: 'Cách đối chiếu',
    codeLabel: 'Mã QR hoặc mã bên gửi',
    codeHint: 'Mã in dưới hình QR, hoặc mã kiện của bên gửi in trên nhãn. Chữ hoa hay thường đều được.',
    codeRequired: 'Nhập mã trước khi đối chiếu.',
    codeSubmit: 'Đối chiếu mã',
    manualIntro: 'Dùng khi nhãn rách, mất hoặc không đọc được. Điều phối viên phải duyệt xác nhận tay trước khi bước này hoàn tất.',
    manualPackage: 'Kiện',
    manualReason: 'Lý do',
    manualNote: 'Ghi chú',
    manualNoteHint: 'Bắt buộc khi chọn Khác.',
    manualSubmit: 'Gửi xác nhận tay',
    manualEmpty: 'Không có kiện nào để xác nhận tay ở bước này.',
    reprint: 'In lại nhãn {id}',
    errors: {
      packageRequired: 'Chọn kiện cần xác nhận.',
      reasonRequired: 'Chọn lý do.',
      noteRequired: 'Chọn Khác thì cần ghi chú.',
      noteTooLong: 'Ghi chú tối đa {max} ký tự.',
    },
    close: 'Đóng',
  },
} as const
