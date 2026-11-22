import { isApiError, isTransientApiError } from '@/lib/api-client'
import type { TFunction } from '@/lib/i18n'
import { MAX_CARTON_KINDS, MAX_TOTAL_QUANTITY } from './try-form'
import { TRY_DESCRIBE_MAX, type ExtractGap, type TryExtract } from './try-extract-values'

/** Nhãn của một mục còn thiếu ("Khối lượng — loại kiện 1", "Chiều dài thùng", "Tổng số kiện vượt 1.000"). */
export function gapLabel(gap: ExtractGap, t: TFunction): string {
  switch (gap.kind) {
    case 'truck':
      return t(`landingTry.describe.gaps.truck.${gap.field}`)
    case 'carton':
      return t(`landingTry.describe.gaps.carton.${gap.field}`, { number: gap.index + 1 })
    case 'cartonKinds':
      return t('landingTry.describe.gaps.cartonKinds', { max: MAX_CARTON_KINDS })
    case 'totalQuantity':
      return t('landingTry.describe.gaps.totalQuantity', { max: MAX_TOTAL_QUANTITY })
  }
}

/** Câu nói đã điền gì; không nhận ra kiện nào thì nói form giữ nguyên. */
export function extractSummary(result: TryExtract, t: TFunction): string {
  const count = Math.min(result.cartons.length, MAX_CARTON_KINDS)
  if (count === 0) return t('landingTry.describe.noCartons')
  const run = t('landingTry.form.run')
  return result.truck === null ? t('landingTry.describe.filledCartons', { count, run }) : t('landingTry.describe.filled', { count, run })
}

/**
 * Câu nói thật vì sao chưa điền được (form giữ nguyên, khách nhập tay): máy chủ bận, hết ngân sách, chưa bật trợ lý, mô tả quá dài hay bị
 * từ chối, không tới được máy chủ. Không câu nào báo thành công.
 */
export function extractErrorMessage(error: unknown, t: TFunction): string {
  if (!isApiError(error)) return t('landingTry.describe.errors.other')
  switch (error.code) {
    case 'ASSISTANT_RATE_LIMITED':
      return t('landingTry.describe.errors.rateLimited')
    case 'ASSISTANT_BUDGET_EXCEEDED':
      return t('landingTry.describe.errors.budget')
    case 'ASSISTANT_UNAVAILABLE':
    case 'NOT_SUPPORTED':
      return t('landingTry.describe.errors.unavailable')
    case 'ASSISTANT_MESSAGE_TOO_LONG':
      return t('landingTry.describe.errors.tooLong', { max: TRY_DESCRIBE_MAX })
    case 'INVALID_INPUT':
    case 'BAD_REQUEST':
      return t('landingTry.describe.errors.invalid')
    default:
      return isTransientApiError(error) ? t('landingTry.describe.errors.network') : t('landingTry.describe.errors.other')
  }
}
