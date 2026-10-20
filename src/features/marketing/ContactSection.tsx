import { Building2, CircleCheck, MailCheck, MessagesSquare, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { useT, type MessageKey } from '@/lib/i18n'
import type { GuestContact } from '@/lib/mock-db'
import { CONTACT_ANCHOR, contactDefaults } from './contact-form'
import { ContactForm } from './ContactForm'
import { PUBLIC_TOUCH } from './public-chrome'
import { LumoSays, Reveal } from './reveal'
import { SectionHeading } from './SectionHeading'
import { usePublicPlansQuery } from './useMarketingQuery'

/** Gửi xong: mã yêu cầu kèm một câu nói điều đã xảy ra, và nút gửi yêu cầu khác. Tiêu đề nhận focus để bàn phím không lạc về đầu trang. */
function ContactSent({ contact, onAgain }: { contact: GuestContact; onAgain: () => void }) {
  const t = useT()
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => headingRef.current?.focus(), [])
  return (
    <div role="status" className="flex flex-col items-start gap-3">
      <span aria-hidden className="grid size-10 place-items-center rounded-md bg-tint-green text-tint-green-fg">
        <CircleCheck className="size-5" strokeWidth={1.5} />
      </span>
      <h3 ref={headingRef} tabIndex={-1} className="m-0 font-display text-h2 leading-7 font-bold text-ink-strong outline-none">
        {t('landing.contact.sent.title', { id: contact.id })}
      </h3>
      <p className="m-0 text-body text-ink-2 pointer-coarse:text-body-lg">{t('landing.contact.sent.text')}</p>
      <Button variant="secondary" className={PUBLIC_TOUCH} onClick={onAgain}>{t('landing.contact.sent.again')}</Button>
    </div>
  )
}

/** Ba việc xảy ra sau khi khách gửi yêu cầu, theo thứ tự; bước cuối là câu "tài khoản công ty do đội LoadMaster tạo". */
const NEXT_STEPS: readonly { icon: LucideIcon; key: MessageKey }[] = [
  { icon: MailCheck, key: 'landing.contact.next.reply' },
  { icon: MessagesSquare, key: 'landing.contact.next.talk' },
  { icon: Building2, key: 'landing.contact.signUpNote' },
]

/** Ba việc sau khi gửi: tiêu đề rồi từng việc nhô lên so le 70 ms, ô biểu tượng bật ra. */
function ContactNextSteps() {
  const t = useT()
  return (
    <Reveal group className="flex flex-col gap-4">
      <Reveal as="h3" className="m-0 font-display text-h3 font-[650] text-sky-text font-stretch-108%">{t('landing.contact.next.title')}</Reveal>
      <ol className="m-0 flex list-none flex-col gap-4 p-0">
        {NEXT_STEPS.map(({ icon: Icon, key }, index) => (
          <Reveal as="li" key={key} index={index + 1} className="flex items-start gap-3 text-body-lg text-sky-text-2">
            <Reveal as="span" kind="pop" delay={150} aria-hidden
              className="grid size-9 flex-none place-items-center rounded-md border border-landing-hairline bg-sky-glass text-cyan-300">
              <Icon className="size-5" strokeWidth={1.5} />
            </Reveal>
            <span className="pt-1">{t(key)}</span>
          </Reveal>
        ))}
      </ol>
    </Reveal>
  )
}

/**
 * Phần "Liên hệ" của trang giới thiệu (`#lien-he`) — lời kêu gọi duy nhất của hai trang công khai: không có nút đăng ký hay mua gói,
 * tài khoản công ty do đội LoadMaster mở sau khi trao đổi. Dải tối cuối trang: tiêu đề, câu mô tả và ba việc xảy ra sau khi gửi bên
 * trái; bên phải Lumo (`wink`) ló lên trên mép thẻ form và gợi ý chọn đúng việc cần — gửi xong bong bóng ẩn, không đổi tư thế. Thẻ form
 * không chuyển động, có mặt ngay (liên kết sâu `#lien-he` tới thẳng nó). Form chờ danh sách gói đang bán (để chọn sẵn gói trên URL
 * `?goi=`); đọc gói lỗi thì form vẫn dùng được, chỉ không có gói để chọn.
 */
export function ContactSection() {
  const t = useT()
  const [searchParams] = useSearchParams()
  const plans = usePublicPlansQuery()
  const [sent, setSent] = useState<GuestContact | null>(null)
  // Gửi yêu cầu khác: form mới, chọn sẵn như lúc mở trang
  const [round, setRound] = useState(0)

  return (
    <section id={CONTACT_ANCHOR} aria-labelledby="landing-contact" className="landing-closing scroll-mt-24 px-4 py-16 md:px-shell lg:py-24">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-14">
        <div className="flex flex-col gap-10">
          <SectionHeading id="landing-contact" tone="dark" title={t('landing.contact.title')} lede={t('landing.contact.lede')} />
          <ContactNextSteps />
        </div>

        <div className="flex min-w-0 flex-col self-start">
          {/* Lumo đứng ngay trên mép trên của thẻ form, lùi khỏi góc bo */}
          <LumoSays pose="wink" px={{ base: 112, md: 144, xl: 176 }} side="bubble-right" text={t('landingStory.lumo.contact')}
            className="pl-4" bubbleClassName={sent !== null ? 'hidden' : 'max-w-sm'} />
          <Card className="p-5 sm:p-7">
            {sent !== null ? (
              <ContactSent contact={sent} onAgain={() => { setSent(null); setRound((value) => value + 1) }} />
            ) : plans.isPending ? (
              <div className="flex justify-center py-16"><Spinner label={t('landing.contact.loading')} /></div>
            ) : (
              <ContactForm
                key={round}
                plans={plans.data ?? []}
                initial={contactDefaults(searchParams, plans.data ?? [])}
                focusFirst={round > 0}
                onSent={setSent}
              />
            )}
          </Card>
        </div>
      </div>
    </section>
  )
}
