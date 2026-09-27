/** Mã QR của kiện (LM-104): `components/QrCode.tsx` và hộp thoại quét `components/QrScanDialog.tsx`. */
export const qr = {
  imageLabel: 'Mã QR {token}',
  scan: {
    camera: {
      starting: 'Đang mở camera…',
      scanning: 'Camera đang quét. Đưa mã QR vào giữa khung hình.',
      unsupported: 'Trình duyệt này không quét được mã QR bằng camera. Nhập mã in dưới hình QR hoặc chọn trong danh sách.',
      denied: 'Chưa được phép dùng camera. Nhập mã in dưới hình QR hoặc chọn trong danh sách.',
      failed: 'Không mở được camera. Nhập mã in dưới hình QR hoặc chọn trong danh sách.',
    },
    manualLabel: 'Nhập mã',
    manualHint: 'Mã in ngay dưới hình QR. Chữ hoa hay thường, có khoảng trắng đều được.',
    manualRequired: 'Nhập mã trước khi xác nhận.',
    submit: 'Xác nhận mã',
    pickTitle: 'Hoặc chọn trong danh sách',
    close: 'Đóng',
  },
} as const
