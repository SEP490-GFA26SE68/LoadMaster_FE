import { isApiError } from '@/lib/api-client'
import { isMockDbError } from '@/lib/mock-db/errors'
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
  // Tham số của từng mã trùng placeholder của câu cùng mã (kiểm ở data-error.test.ts); TFunction không suy được từ mã động.
  const translate = t as unknown as (key: string, values: Record<string, string | number>) => string
  return translate(`dataErrors.${error.code}`, params)
}
