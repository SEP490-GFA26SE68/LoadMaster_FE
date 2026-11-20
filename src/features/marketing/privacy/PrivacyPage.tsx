import { useT } from '@/lib/i18n'
import { LEGAL_UPDATED_AT } from '../legal/legal-facts'
import { LegalPage } from '../legal/LegalPage'
import { usePrivacySections } from './privacy-sections'

const SUMMARY = ['input', 'tenancy', 'gps', 'tracking', 'rights'] as const

/**
 * Chính sách bảo mật công khai `/chinh-sach-bao-mat` trong khung chung của trang pháp lý (`legal/LegalPage`): năm ý tóm tắt rồi mười hai
 * mục đánh số. Mỗi câu nói đúng điều mã hôm nay làm, chọn theo nguồn đang chạy (máy chủ hay bản demo); không pháp nhân, địa chỉ hay cam
 * kết nào chưa có, và thời hạn lưu chỉ nói điều đã có luật. Lối hỏi là form liên hệ (thẻ cuối trang).
 */
export function PrivacyPage() {
  const t = useT()
  const sections = usePrivacySections()
  return (
    <LegalPage
      doc="privacy"
      title={t('privacy.title')}
      lede={t('privacy.lede')}
      updatedAt={LEGAL_UPDATED_AT}
      summary={SUMMARY.map((key) => t(`privacy.summary.${key}`))}
      sections={sections}
    />
  )
}
