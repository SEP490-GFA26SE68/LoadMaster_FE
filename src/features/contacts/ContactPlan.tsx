import { useT } from '@/lib/i18n'
import type { ContactRow } from './contact-list'

/**
 * Gói khách quan tâm, ở bảng và khung bên phải: tên gói; chưa có tên (danh mục gói tải lỗi, gói đã bị xoá) thì mã gói — khách vẫn đã
 * chọn một gói; "Chưa chọn" chỉ khi khách không chọn gói nào.
 */
export function ContactPlan({ row }: { row: ContactRow }) {
  const t = useT()
  if (row.contact.interestedPlanId === undefined) return <span className="text-ink-3">{t('contacts.page.noPlan')}</span>
  if (row.planName === undefined) return <span className="font-mono text-caption text-ink-1">{row.contact.interestedPlanId}</span>
  return <span className="text-ink-1">{row.planName}</span>
}
