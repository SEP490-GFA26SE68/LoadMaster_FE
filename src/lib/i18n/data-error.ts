import { isApiError } from '@/lib/api-client'
import { isMockDbError, type MockDbError } from '@/lib/mock-db/errors'
import type { TFunction } from './types'
import { apiErrors } from './vi/apiErrors'

/**
 * Câu cho lỗi của một lượt gọi dữ liệu. Lỗi kho mẫu (`MockDbError`, D-28): câu `dataErrors.<mã>` theo ngôn ngữ của `t`, điền tham số của
 * mã (mảng nối bằng dấu phẩy). Lỗi backend (`ApiError`): câu `apiErrors.<mã>`, không bao giờ hiện thông điệp thô của máy chủ. Mã khác →
 * câu chung `dataErrors.UNKNOWN`.
 */
export function dataErrorMessage(error: unknown, t: TFunction): string {
  if (isApiError(error)) return error.code in apiErrors ? t(`apiErrors.${error.code as keyof typeof apiErrors}`) : t('dataErrors.UNKNOWN')
  if (!isMockDbError(error)) return t('dataErrors.UNKNOWN')
  const params = Object.fromEntries(
    Object.entries(error.params).map(([name, value]) => [name, Array.isArray(value) ? value.join(', ') : value]),
  ) as Record<string, string | number>
  const field = fieldLabel(error, t)
  if (field !== undefined) params.field = field
  // Tham số của từng mã trùng placeholder của câu cùng mã (kiểm ở data-error.test.ts); TFunction không suy được từ mã động.
  const translate = t as unknown as (key: string, values: Record<string, string | number>) => string
  return translate(`dataErrors.${error.code}`, params)
}

/**
 * Mã có câu nêu tên trường (`{field}`): tham số `field` là mã trường của kho, câu nhận tên trường theo ngôn ngữ đang chọn — như cột của
 * file nhập (`sourcing.import.dimensionFields`). Mã `*_INVALID` khác liệt kê điều kiện, không nêu trường.
 */
function fieldLabel(error: MockDbError, t: TFunction): string | undefined {
  if (error.code !== 'CONTACT_INVALID') return undefined
  return t(`contacts.fields.${(error as MockDbError<'CONTACT_INVALID'>).params.field}`)
}
