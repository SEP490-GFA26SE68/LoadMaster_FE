/**
 * Hộp "Xem chi tiết" của một công ty ở màn Công ty `/nen-tang/cong-ty` khi nối backend (`platform/ViewCompanyDetailsDialog`): hồ sơ trên
 * máy chủ, gói cước, thoả thuận dịch vụ của công ty dùng thử. Gắn vào nhánh `platform.companyDetails`.
 */
export const companyDetails = {
  description: 'Mã {code}',
  company: {
    title: 'Doanh nghiệp',
    taxCode: 'Mã số thuế',
    billingEmail: 'Email nhận hoá đơn',
    status: 'Trạng thái',
    createdAt: 'Ngày tạo',
    notUpdated: 'Chưa cập nhật',
  },
  plan: {
    title: 'Gói cước',
    name: 'Gói',
    status: 'Trạng thái gói',
    expires: 'Hết hạn',
    users: 'Người dùng',
    none: 'Công ty chưa có gói cước.',
    notLoaded: 'Chưa đọc được gói của công ty.',
  },
  agreement: {
    title: 'Thoả thuận dịch vụ',
    status: 'Trạng thái',
    signed: 'Đã ký',
    expired: 'Quá hạn ký',
    pending: { one: 'Chờ ký — còn {count} giờ', other: 'Chờ ký — còn {count} giờ' },
    code: 'Mã thoả thuận',
    deadline: 'Hạn ký',
    signer: 'Người ký',
    signedAt: 'Ký lúc',
    view: 'Xem văn bản',
    none: 'Công ty chưa có thoả thuận dịch vụ.',
    loading: 'Đang tải thoả thuận',
  },
  edit: 'Sửa thông tin',
  close: 'Đóng',
} as const
