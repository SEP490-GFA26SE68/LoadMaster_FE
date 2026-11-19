import { Check } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { useT } from '@/lib/i18n'
import { PublicPage } from '../PublicPage'
import type { LegalDoc } from './legal-facts'
import { LegalFooterCards } from './LegalFooterCards'
import { LegalHeader } from './LegalHeader'
import { LegalSection, type LegalSectionSpec } from './LegalParts'
import { LegalToc } from './LegalToc'
import { useActiveSection } from './useActiveSection'

/** Khối "Tóm tắt nhanh": vài ý bằng lời thường, đọc trước khi vào từng mục. Nền tint cyan đặc, không phải nút hay liên kết. */
function LegalSummary({ points }: { points: readonly string[] }) {
  const t = useT()
  return (
    <section
      aria-labelledby="legal-summary"
      className="rounded-lg border border-cyan-200 bg-primary-bg p-5 sm:p-6 print:border-border print:bg-transparent print:p-4"
    >
      <h2 id="legal-summary" className="m-0 font-display text-h3 font-[650] text-ink-strong font-stretch-106%">{t('legal.summary.title')}</h2>
      <ul className="m-0 mt-3 flex list-none flex-col gap-2.5 p-0">
        {points.map((point) => (
          <li key={point} className="flex max-w-[72ch] gap-2.5 text-body-lg text-pretty text-ink-1">
            <Check aria-hidden className="mt-1 size-4 flex-none text-primary" strokeWidth={1.5} />
            <span>{point}</span>
          </li>
        ))}
      </ul>
      <p className="m-0 mt-3.5 text-small text-ink-2 pointer-coarse:text-body-lg">{t('legal.summary.note')}</p>
    </section>
  )
}

/**
 * Khung chung của hai trang pháp lý công khai (ngoài `RequireAuth`, không quyền nào): đầu trang trên dải trời, rồi mục lục bên trái (dính
 * từ 1.024 px, thu gọn trên điện thoại) và cột đọc bên phải — khối tóm tắt, một thẻ nền đặc chứa các mục đánh số, hai thẻ cuối (tài liệu
 * kia, lối hỏi). Trang chỉ có nút phụ. Bản in bỏ mục lục, nút và khung thẻ, giữ chữ.
 */
export function LegalPage({ doc, title, lede, updatedAt, summary, sections }: {
  doc: LegalDoc
  title: string
  lede: string
  updatedAt: Date
  summary: readonly string[]
  sections: readonly LegalSectionSpec[]
}) {
  const active = useActiveSection(sections.map((section) => section.id))
  return (
    <PublicPage>
      <LegalHeader doc={doc} title={title} lede={lede} updatedAt={updatedAt} />
      <div className="grid gap-6 px-4 pt-6 pb-14 md:px-shell lg:grid-cols-[16.5rem_minmax(0,1fr)] lg:gap-12 lg:pt-10 lg:pb-18 print:block print:p-0">
        <LegalToc sections={sections} active={active} />
        <div className="flex max-w-208 min-w-0 flex-col gap-6">
          <LegalSummary points={summary} />
          <Card className="flex flex-col gap-7 p-5 sm:p-8 print:gap-5 print:border-0 print:p-0 print:shadow-none">
            {sections.map((section, index) => <LegalSection key={section.id} section={section} number={index + 1} />)}
          </Card>
          <LegalFooterCards doc={doc} />
        </div>
      </div>
    </PublicPage>
  )
}
