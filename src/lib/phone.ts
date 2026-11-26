import { isPhoneValidForCountry } from '@/components/ui/PhoneInput'

/**
 * Số điện thoại của người dùng — form tài khoản của quản trị (LM-092) và hồ sơ cá nhân (LM-096) dùng chung.
 * 10 chữ số bắt đầu bằng đầu số di động Việt Nam (03x, 05x, 07x, 08x, 09x); người nhập được gõ kèm khoảng trắng.
 * Kho lưu dạng hiển thị "0901 234 567", nên mở form rồi lưu không đổi gì thì kho không thấy thay đổi.
 */
export const PHONE_PATTERN = /^(0[35789][0-9]{8}|(\+?84)[35789][0-9]{8})$/

export function isVietnameseMobilePhone(value: string): boolean {
  return isPhoneValidForCountry(value, 'VN')
}

/** Bỏ khoảng trắng: "0901 234 567" → "0901234567". */
export function phoneDigits(value: string): string {
  return value.replace(/\s/g, '')
}

/** Dạng hiển thị của kho: "0901234567" → "0901 234 567". Đầu vào đã khớp `PHONE_PATTERN`. */
export function formatPhone(digits: string): string {
  return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`
}
