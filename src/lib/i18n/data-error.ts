import { isMockDbError } from '@/lib/mock-db/errors'
import type { TFunction } from './types'

/**
 * Câu cho lỗi của một lượt gọi kho (`MockDbError`, D-28): chọn câu `dataErrors.<mã>` theo ngôn ngữ của `t`, điền tham số của mã
 * (mảng nối bằng dấu phẩy). Nếu là lỗi từ Backend (`ApiError`) có thông báo rõ ràng thì hiển thị thông báo đó; lỗi khác → `dataErrors.UNKNOWN`.
 */
export function dataErrorMessage(error: unknown, t: TFunction): string {
  if (!isMockDbError(error)) {
    if (
      error instanceof Error &&
      error.name === 'ApiError' &&
      error.message.trim().length > 0 &&
      !error.message.startsWith('API request failed:')
    ) {
      return error.message
    }
    return t('dataErrors.UNKNOWN')
  }
  const params = Object.fromEntries(
    Object.entries(error.params).map(([name, value]) => [name, Array.isArray(value) ? value.join(', ') : value]),
  ) as Record<string, string | number>
  // Tham số của từng mã trùng placeholder của câu cùng mã (kiểm ở data-error.test.ts); TFunction không suy được từ mã động.
  const translate = t as unknown as (key: string, values: Record<string, string | number>) => string
  return translate(`dataErrors.${error.code}`, params)
}

