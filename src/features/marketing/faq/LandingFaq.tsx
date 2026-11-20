import { ChevronDown } from 'lucide-react'
import { LUMO_NAME } from '@/components/brand/Lumo'
import { useT } from '@/lib/i18n'
import { TopicAnswer } from '../assistant/AssistantAnswer'
import { useAssistantContext } from '../assistant/useAssistantChat'
import { PUBLIC_TOUCH } from '../public-chrome'
import { Reveal } from '../reveal'
import { SectionHeading } from '../SectionHeading'
import { FAQ_TOPICS } from './faq-topics'
import { FaqStructuredData } from './FaqStructuredData'
import './faq.css'

/**
 * Phần "Hỏi đáp" của trang giới thiệu (`#hoi-dap`, giữa Gói cước và dải liên hệ). Câu hỏi là `chip` của từng chủ đề trợ lý, câu trả lời
 * là chính câu trả lời của Lumo (`TopicAnswer`, cùng ngữ cảnh `useAssistantContext`: khách tự đăng ký được thì câu "Dùng thử thế nào?" và
 * liên kết của nó đổi theo) — sửa một câu trả lời ở từ điển `assistant` là cả hai nơi đổi. Mỗi câu là một `<details>` gốc: mở bằng chuột,
 * bàn phím (Enter, Space) và trình đọc màn hình không cần JavaScript; dòng câu hỏi cao ít nhất 44 px, 56 px trên máy cảm ứng.
 */
export function LandingFaq() {
  const t = useT()
  const context = useAssistantContext()
  return (
    <section id="hoi-dap" aria-labelledby="landing-faq" className="scroll-mt-24 px-4 py-8 sm:py-12 md:px-shell lg:py-16">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14">
        <SectionHeading id="landing-faq" title={t('landingFaq.title')} lede={t('landingFaq.lede', { name: LUMO_NAME })} />
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {FAQ_TOPICS.map((id, index) => (
            <Reveal key={id} as="li" index={index}>
              <details className="faq-item group rounded-lg border border-border bg-bg">
                <summary className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-4 py-2.5 outline-none hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary pointer-coarse:min-h-14 sm:px-5">
                  <span className="flex-1 text-body-lg font-semibold text-pretty text-ink-strong group-open:text-primary">
                    {t(`assistant.topics.${id}.chip`)}
                  </span>
                  <ChevronDown aria-hidden className="faq-chevron size-5 flex-none text-ink-3" strokeWidth={1.5} />
                </summary>
                <div className="faq-answer px-4 pt-1 pb-5 text-body-lg text-ink-2 sm:px-5">
                  <TopicAnswer topicId={id} context={context} actionClassName={PUBLIC_TOUCH} />
                </div>
              </details>
            </Reveal>
          ))}
        </ul>
      </div>
      <FaqStructuredData />
    </section>
  )
}
