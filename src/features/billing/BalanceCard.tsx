import { Coins } from 'lucide-react'
import { KpiTile } from '@/components/KpiTile'
import { useFormat, useT } from '@/lib/i18n'
import type { CreditBalance } from '@/lib/mock-db'

/**
 * Số dư credit của công ty (FE-8-03): gói không giới hạn ghi "Không giới hạn" thay vì số, kèm câu nói lần chạy tối ưu không trừ gì;
 * gói khác ghi cách tính (một lần chạy 3D dùng 1 credit). Số lấy từ sổ cái của kho.
 */
export function BalanceCard({ credit }: { credit: CreditBalance }) {
  const t = useT()
  const format = useFormat()
  return (
    <KpiTile
      label={t('billing.credit.balance')}
      value={credit.unlimited ? t('common.unlimitedCredits') : format.integer(credit.balance)}
      note={credit.unlimited ? t('billing.credit.unlimitedNote') : t('billing.credit.note')}
      icon={Coins}
      tone="blue"
    />
  )
}
