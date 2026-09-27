import { Play } from 'lucide-react'
import { FormSection } from '@/components/FormSection'
import { Button } from '@/components/ui/Button'
import { useT } from '@/lib/i18n'
import { Preview, SheetCard } from '../SheetLayout'

/**
 * Đầu mục đánh số của form dài (`FormSection`, form chuyến) và chú thích nổi nói lý do nút chính đang khoá — bong bóng vẽ bằng lớp
 * của `TooltipContent`, đặt tĩnh trên nút vô hiệu hoá của Thiết lập tối ưu.
 */
export function FormSectionCard() {
  const t = useT()
  const title = t('designSystem.components.formSection.title')
  return (
    <SheetCard title={title} bodyClassName="gap-5">
      <div className="flex flex-col gap-4">
        <FormSection number={1} title={t('trips.create.infoTitle')} description={t('trips.create.infoHint')}>{null}</FormSection>
        <FormSection number={2} title={t('trips.create.stopsTitle')} description={t('trips.create.stopsRequired')} className="pt-4">
          {null}
        </FormSection>
      </div>
      <Preview label={title} className="flex flex-col items-start gap-2.5">
        <span className="relative rounded-sm bg-cyan-950 px-2.5 py-1.5 text-fine text-cyan-50 shadow-e2">
          {t('optimization.blocked')}
          <span aria-hidden className="absolute -bottom-1 left-5 size-2 rotate-45 bg-cyan-950" />
        </span>
        <Button disabled><Play strokeWidth={1.75} aria-hidden />{t('optimization.run')}</Button>
      </Preview>
    </SheetCard>
  )
}
