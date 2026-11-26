import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/Badge'
import { useT } from '@/lib/i18n'
import { GlassChip } from '../panels/scene-ui'

/** Nhãn nguồn của một chỉ số: `mock` là kết quả của mock (MOCK RESULT, không dịch), `estimate` là phép ước tính của Planner. */
export type IndicatorTag = 'mock' | 'estimate'

/** Nhãn nguồn đặt cạnh tiêu đề thẻ chỉ số trên nền tối của khung 3D. */
export function IndicatorTagChip({ tag }: { tag: IndicatorTag }) {
  const t = useT()
  return tag === 'mock'
    ? <Badge shape="tag" tone="mock" className="border-amber-500/45 text-amber-500">MOCK RESULT</Badge>
    : <GlassChip tone="grey" size="tag" data-estimate-tag>{t('plannerPhysics.estimateTag')}</GlassChip>
}

/** Thẻ một chỉ số của phương án ở hộp Chi tiết (tab Vận hành): tiêu đề, nhãn nguồn, dòng phụ tuỳ chọn ("Tại bước n / N"), nội dung. */
export function IndicatorCard({ title, tag, subtitle, children, ...data }: {
  title: string; tag?: IndicatorTag; subtitle?: ReactNode; children: ReactNode
} & { [key: `data-${string}`]: string | number | undefined }) {
  return (
    <section aria-label={title} {...data} className="flex w-full min-w-64 flex-col gap-2 rounded-lg border border-glass-dark-border bg-canvas-2/45 p-3 text-body-lg xl:text-caption">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold text-sky-text">{title}</h3>
        {tag ? <IndicatorTagChip tag={tag} /> : null}
      </div>
      {subtitle ? <p className="-mt-1.5 text-glass-dark-muted">{subtitle}</p> : null}
      {children}
    </section>
  )
}
