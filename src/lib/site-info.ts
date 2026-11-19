/**
 * Thông tin công khai của LoadMaster cho chân trang của các trang công khai — một chỗ duy nhất. Chỉ ghi điều đã có thật: hôm nay chưa có
 * hộp thư hỗ trợ, số điện thoại, địa chỉ hay mã số thuế nào được công bố, nên cả bốn để trống và chân trang không vẽ dòng nào cho chúng
 * (khách liên hệ qua form `#lien-he`). Có thông tin thật thì điền ở đây, không sửa component.
 */
type SiteInfo = {
  readonly name: string
  readonly supportEmail: string | null
  readonly phone: string | null
  readonly address: string | null
  readonly taxCode: string | null
}

export const SITE_INFO: SiteInfo = {
  name: 'LoadMaster',
  supportEmail: null,
  phone: null,
  address: null,
  taxCode: null,
}
