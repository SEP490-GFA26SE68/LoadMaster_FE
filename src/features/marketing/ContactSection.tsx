import { Building2, CircleCheck, MailCheck, MessagesSquare, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router'
import { LUMO_NAME } from '@/components/brand/Lumo'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { REGISTRATION_CAPABILITIES } from '@/features/registration/useRegistrationQuery'
import { useT, type MessageKey } from '@/lib/i18n'
import type { GuestContact } from '@/lib/mock-db'
import { handoffMessage, handoffQuestionsOf } from './assistant/assistant-handoff'
import { CONTACT_ANCHOR, contactDefaults } from './contact-form'
import { ContactForm } from './ContactForm'
import { PUBLIC_TOUCH } from './public-chrome'
import { SectionHeading } from './SectionHeading'
import { usePublicPlansQuery } from './useMarketingQuery'
import { useNearViewport } from './useNearViewport'

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

/**
 * Ba việc xảy ra sau khi khách gửi yêu cầu, theo thứ tự. Bước cuối nói đúng cách có tài khoản của chế độ đang chạy: khách tự đăng ký
 * được (`REGISTRATION_CAPABILITIES.publicSignUp`) thì "bạn tự đăng ký", kho mẫu thì "đội LoadMaster tạo sau khi trao đổi". Chỉ từ 640 px:
 * trên điện thoại form đứng ngay dưới tiêu đề; cách có tài khoản nằm ở "Hỏi đáp" ngay trên, gửi xong có câu nói việc kế tiếp.
 */
const NEXT_STEPS: readonly { icon: LucideIcon; key: MessageKey }[] = [
  { icon: MailCheck, key: 'landing.contact.next.reply' },
  { icon: MessagesSquare, key: 'landing.contact.next.talk' },
  { icon: Building2, key: REGISTRATION_CAPABILITIES.publicSignUp ? 'landing.contact.signUpNoteSelf' : 'landing.contact.signUpNote' },
]

function ContactNextSteps() {
  const t = useT()
  return (
    <div className="flex flex-col gap-4 max-sm:hidden">
      <h3 className="m-0 font-display text-h3 font-[650] text-sky-text font-stretch-108%">{t('landing.contact.next.title')}</h3>
      <ol className="m-0 flex list-none flex-col gap-4 p-0">
        {NEXT_STEPS.map(({ icon: Icon, key }) => (
          <li key={key} className="flex items-start gap-3 text-body-lg text-sky-text-2">
            <span aria-hidden className="grid size-9 flex-none place-items-center rounded-md border border-landing-hairline bg-sky-glass text-cyan-300">
              <Icon className="size-5" strokeWidth={1.5} />
            </span>
            <span className="pt-1">{t(key)}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

/**
 * Phần "Liên hệ" của trang giới thiệu (`#lien-he`). Dải tối cuối trang: tiêu đề, câu mô tả và ba việc xảy ra sau khi gửi bên trái; form
 * trong thẻ trắng bên phải. Phần này không có nút đăng ký: ở kho mẫu tài khoản công ty do đội LoadMaster mở sau khi trao đổi, khi nối
 * máy chủ lối đăng ký nằm ở phần mở đầu, đầu trang và thẻ gói. Form chờ danh sách gói đang bán (để chọn sẵn gói trên URL `?goi=`); đọc
 * gói lỗi thì form vẫn dùng được, chỉ không có gói để chọn. Danh mục gói chỉ đọc khi phần này tới gần khung nhìn (`useNearViewport`) —
 * liên kết sâu `#lien-he` cuộn thẳng tới đây nên đọc ngay. Khách chuyển câu hỏi từ trợ lý "Hỏi Lumo" thì câu hỏi đi trong `state` của lần
 * điều hướng (không lên URL): mỗi lần điều hướng mang câu hỏi được đọc một lần, điền sẵn ô nội dung của form đang mở (form đã gửi thì mở
 * lại form); "Gửi yêu cầu khác" sau đó là form trống như thường.
 */
export function ContactSection() {
  const t = useT()
  const [searchParams] = useSearchParams()
  const [sectionRef, near] = useNearViewport<HTMLElement>()
  const plans = usePublicPlansQuery(near)
  const [sent, setSent] = useState<GuestContact | null>(null)
  // Gửi yêu cầu khác: form mới, chọn sẵn như lúc mở trang
  const [round, setRound] = useState(0)
  const location = useLocation()
  const handoff = handoffQuestionsOf(location.state)
  const [prefill, setPrefill] = useState<{ key: string; message: string; round: number } | null>(null)
  if (handoff !== null && handoff.length > 0 && prefill?.key !== location.key) {
    setPrefill({ key: location.key, message: handoffMessage(t('assistant.handoff.intro', { name: LUMO_NAME }), handoff), round })
    setSent(null)
  }
  const message = prefill !== null && prefill.round === round ? prefill.message : ''

  return (
    <section ref={sectionRef} id={CONTACT_ANCHOR} aria-labelledby="landing-contact" className="landing-closing scroll-mt-24 px-4 py-8 sm:py-12 md:px-shell lg:py-16">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-12">
        <div className="flex flex-col gap-8">
          <SectionHeading id="landing-contact" tone="dark" title={t('landing.contact.title')} lede={t('landing.contact.lede')} />
          <ContactNextSteps />
        </div>

        <Card className="self-start p-5 sm:p-7">
          {sent !== null ? (
            <ContactSent contact={sent} onAgain={() => { setSent(null); setRound((value) => value + 1) }} />
          ) : plans.isPending ? (
            <div className="flex justify-center py-16"><Spinner label={t('landing.contact.loading')} /></div>
          ) : (
            <ContactForm
              key={`${round}-${prefill?.key ?? ''}`}
              plans={plans.data ?? []}
              initial={contactDefaults(searchParams, plans.data ?? [], message)}
              focusFirst={round > 0}
              onSent={setSent}
            />
          )}
        </Card>
      </div>
    </section>
  )
}
