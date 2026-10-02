/**
 * Mã QR của kiện (LM-104): `components/QrCode.tsx`, hộp thoại quét `components/QrScanDialog.tsx` và chữ trên nhãn in của kiện
 * (`label`, FE-3b-05 — `package-pool/PackageLabel.tsx`).
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
