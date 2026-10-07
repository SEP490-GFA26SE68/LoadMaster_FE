import { useFormat, useT } from '@/lib/i18n'
import type { OptimizationCredit } from './optimization-api'

/**
 * Câu "Lần chạy này dùng 1 credit · còn N" (FE-8-05, D-89): `left` là số credit còn lại sau lần chạy. Gói không giới hạn ghi 0 credit và
 * "Không giới hạn", không có số còn lại.
 */
export function useCreditUsageText() {
  const t = useT()
  const format = useFormat()
  return (credit: Pick<OptimizationCredit, 'cost' | 'balance' | 'unlimited'>, left = credit.balance) =>
    credit.unlimited ? t('optimization.credit.usageUnlimited') : t('optimization.credit.usage', { count: credit.cost, left: format.integer(left) })
}
