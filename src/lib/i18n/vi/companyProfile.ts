/**
 * Thông tin công ty `/cong-ty`: quản trị công ty xem và sửa thông tin của công ty mình. Câu lỗi của ô dùng chung với form công ty của
 * quản trị hệ thống (`companies.form.errors`, `companies.server.form.errors`), nhãn trạng thái công ty với `companies.server.status`.
 */
export const companyProfile = {
  title: 'Thông tin công ty',
  loading: 'Đang tải thông tin công ty',
  retry: 'Thử lại',
  /** Thẻ bên trái: tên công ty và những thông tin chỉ quản trị hệ thống đổi được. */
  identity: {
    label: 'Công ty',
    code: 'Mã công ty',
    taxCode: 'Mã số thuế',
    createdAt: 'Ngày tạo',
    depot: 'Kho xuất phát',
    serverNote: 'Mã công ty, mã số thuế và trạng thái do quản trị hệ thống LoadMaster thay đổi.',
    note: 'Mã công ty và kho xuất phát do quản trị hệ thống LoadMaster thay đổi.',
  },
  form: {
    title: 'Thông tin chung',
    // Nối backend: máy chủ chỉ lưu tên và email thanh toán
    serverDescription: 'Tên công ty và email thanh toán. Máy chủ chưa lưu địa chỉ hay số điện thoại của công ty.',
    description: 'Tên, địa chỉ và số điện thoại của công ty.',
    name: 'Tên công ty',
    billingEmail: 'Email thanh toán',
    address: 'Địa chỉ',
    phone: 'Số điện thoại công ty',
    save: 'Lưu thay đổi',
    saved: 'Đã lưu thông tin công ty',
  },
} as const
