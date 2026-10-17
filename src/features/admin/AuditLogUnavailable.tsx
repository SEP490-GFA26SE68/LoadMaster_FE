import { EmptyState } from '@/components/EmptyState'
import { PageHero } from '@/components/PageHero'
import { Badge } from '@/components/ui/Badge'
import { useT } from '@/lib/i18n'

/**
 * Nhật ký khi người dùng đã nối backend: backend chưa có nhật ký hoạt động nên màn nói vậy — không hiện sự kiện của kho mẫu, không có
 * bộ lọc hay số liệu nào (không bịa số, D-20).
 */
export function AuditLogUnavailable() {
  const t = useT()
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PageHero title={t('audit.log.title')} description={t('pageHero.audit')} badge={<Badge>{t('audit.log.readOnly')}</Badge>} />
      <div className="min-h-0 flex-1 overflow-auto px-shell py-6">
        <EmptyState mascot="empty" wide title={t('audit.log.unavailableTitle')} description={t('audit.log.unavailableDescription')} />
      </div>
    </div>
  )
}
