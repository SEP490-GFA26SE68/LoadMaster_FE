import type { Formatter } from '@/lib/format'
import { formatIssue, type TFunction } from '@/lib/i18n'
import { DEFAULT_SETTINGS } from '@/features/optimization/optimization-request'
import { MAX_TOTAL_QUANTITY, TRY_ERRORS, type FieldLimits } from './try-form'
import { TryRunError } from './try-api'
import { isAbort } from './useTryRun'

/** Câu lỗi của một ô theo key của schema; khoảng nhận được ghi bằng số của ngôn ngữ đang chọn ("0,1" · "0.1"). */
export function tryFieldError(t: TFunction, format: Formatter, message: string | undefined, limits: FieldLimits): string | undefined {
  switch (message) {
    case undefined:
      return undefined
    case TRY_ERRORS.required:
      return t(TRY_ERRORS.required)
    case TRY_ERRORS.number:
      return t(TRY_ERRORS.number)
    case TRY_ERRORS.integer:
      return t(TRY_ERRORS.integer)
    case TRY_ERRORS.totalQuantity:
      return t(TRY_ERRORS.totalQuantity, { max: format.integer(MAX_TOTAL_QUANTITY) })
    default:
      return t(TRY_ERRORS.range, { min: format.lengthValue(limits.min), max: format.lengthValue(limits.max) })
  }
}

function serviceCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('name' in error) || error.name !== 'OptimizationServiceError') return undefined
  return 'code' in error && typeof error.code === 'string' ? error.code : undefined
}

/**
 * Câu nói thật vì sao lần thử không ra kết quả: dòng đầu là lý do, các dòng sau (nếu có) là từng lỗi ràng buộc dịch bằng `formatIssue`.
 * Huỷ không phải lỗi; service không chạy được (worker hỏng, mock ném lỗi) nói đúng là trình duyệt không chạy được.
 */
export function tryErrorLines(error: unknown, t: TFunction, format: Formatter): string[] {
  if (isAbort(error)) return [t('landingTry.failure.cancelled')]
  if (error instanceof TryRunError) {
    if (error.code === 'FAILED') return [t('landingTry.failure.failed')]
    return [t('landingTry.failure.invalid'), ...error.issues.map((issue) => formatIssue(issue, t, format))]
  }
  if (serviceCode(error) === 'TIME_LIMIT_EXCEEDED') {
    return [t('landingTry.failure.timeout', { seconds: format.integer(DEFAULT_SETTINGS.timeLimitSeconds) })]
  }
  return [t('landingTry.failure.service')]
}
