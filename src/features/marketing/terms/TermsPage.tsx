import { useT } from '@/lib/i18n'
import { BILLING_CONSTANTS } from '@/lib/mock-db/billing-model'
import { LEGAL_UPDATED_AT } from '../legal/legal-facts'
import { LegalPage } from '../legal/LegalPage'
import { useTermsSections } from './terms-sections'

const SUMMARY = ['account', 'credit', 'results', 'data', 'cancel'] as const

/**
 * Điều khoản sử dụng công khai `/dieu-khoan-su-dung` trong khung chung của trang pháp lý (`legal/LegalPage`), cùng nhịp với Chính sách
 * bảo mật: năm ý tóm tắt rồi mười một mục đánh số. Không pháp nhân, địa chỉ hay điều luật nào chưa có; số về credit, kỳ gói và hạn dùng
 * thử đọc từ hằng của code. Lối hỏi là form liên hệ (thẻ cuối trang).
 */
export function TermsPage() {
  const t = useT()
  const sections = useTermsSections()
  return (
    <LegalPage
      doc="terms"
      title={t('terms.title')}
      lede={t('terms.lede')}
      updatedAt={LEGAL_UPDATED_AT}
      summary={SUMMARY.map((key) => t(`terms.summary.${key}`, { cost: BILLING_CONSTANTS.optimizationCost }))}
      sections={sections}
    />
  )
}
