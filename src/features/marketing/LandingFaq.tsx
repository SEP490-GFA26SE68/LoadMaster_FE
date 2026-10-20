import { ChevronDown, MessageCircleQuestion } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/Button'
import { PUBLIC_HOME } from '@/features/auth/landing'
import { useT } from '@/lib/i18n'
import { FAQ_ANCHOR } from './anchors'
import { CONTACT_ANCHOR } from './contact-form'
import { FAQ_IDS, type FaqId } from './faq/faq-items'
import { PUBLIC_TOUCH } from './public-chrome'
import { LineRise, Reveal } from './reveal'
import { SectionHeading } from './SectionHeading'
import './faq/faq.css'

/** Một câu hỏi: `<details>` gốc — mở / đóng bằng chuột, chạm, Enter, Space mà không cần mã; tên của nút là chính câu hỏi. */
function FaqItem({ id, open }: { id: FaqId; open: boolean }) {
  const t = useT()
  return (
    <details open={open} className="faq-item group rounded-lg border border-border bg-bg open:shadow-card">
      <summary className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-4 py-2.5 text-left hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary pointer-coarse:min-h-14 sm:px-5">
        <span className="flex-1 text-body-lg font-semibold text-pretty text-ink-strong group-open:text-primary">
          {t(`landingFaq.items.${id}.q`)}
        </span>
        <ChevronDown aria-hidden className="faq-chevron size-5 flex-none text-ink-3" strokeWidth={1.5} />
      </summary>
      <div className="faq-answer px-4 pt-1 pb-5 sm:px-5">
        <p className="m-0 max-w-[62ch] text-body-lg text-pretty text-ink-2">{t(`landingFaq.items.${id}.a`)}</p>
      </div>
    </details>
  )
}

/**
 * "Câu hỏi thường gặp" (`#hoi-dap`): mười câu hỏi, mỗi câu một `<details>` (câu đầu mở sẵn), trả lời bằng điều ứng dụng làm được thật.
 * Từ 1.024 px tiêu đề và lối hỏi thêm ở cột trái, danh sách ở cột phải; hẹp hơn lối hỏi thêm nằm sau danh sách (cùng thứ tự đọc). Câu chữ là chuỗi thuần của nhánh `landingFaq.items` — thẻ
 * FAQPage (JSON-LD) đọc thẳng nhánh đó. Lối hỏi thêm là nút phụ tới form liên hệ: nút chính duy nhất của trang vẫn là "Nhận tư vấn".
 * Cuộn tới thì từng câu hỏi nhô lên so le.
 */
export function LandingFaq() {
  const t = useT()
  return (
    <section id={FAQ_ANCHOR} aria-labelledby="landing-faq" className="scroll-mt-24 px-4 py-16 md:px-shell lg:py-24">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:grid-rows-[auto_1fr] lg:gap-x-16">
        <SectionHeading id="landing-faq" title={t('landingFaq.title')} lede={t('landingFaq.lede')} className="lg:col-start-1 lg:row-start-1 [&>p]:text-balance" />
        <Reveal group as="ul" className="m-0 flex min-w-0 list-none flex-col gap-3 p-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          {FAQ_IDS.map((id, index) => (
            <Reveal as="li" key={id} index={index}>
              <FaqItem id={id} open={index === 0} />
            </Reveal>
          ))}
        </Reveal>
        <Reveal kind="fade" className="flex flex-col items-start gap-3 border-t border-line-soft pt-6 lg:col-start-1 lg:row-start-2 lg:self-start">
          <LineRise as="p" className="m-0 text-body-lg text-ink-2" lines={[t('landingFaq.more')]} />
          <Button asChild variant="secondary" size="lg" className={PUBLIC_TOUCH}>
            <Link to={{ pathname: PUBLIC_HOME, hash: `#${CONTACT_ANCHOR}` }}>
              <MessageCircleQuestion aria-hidden strokeWidth={1.5} />
              {t('landingFaq.contact')}
            </Link>
          </Button>
        </Reveal>
      </div>
    </section>
  )
}
