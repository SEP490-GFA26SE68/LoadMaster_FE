import { Building2, CircleCheck } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { useT } from '@/lib/i18n'
import type { GuestContact } from '@/lib/mock-db'
import { CONTACT_ANCHOR, contactDefaults } from './contact-form'
import { ContactForm } from './ContactForm'
import { PUBLIC_TOUCH } from './public-chrome'
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
        {t('landing.contact.sent.title')}
      </h3>
      <p className="m-0 text-caption font-medium text-ink-muted">
        Mã tiếp nhận: #{contact.id}
      </p>
      <p className="m-0 text-body text-ink-2 pointer-coarse:text-body-lg">{t('landing.contact.sent.text')}</p>
      <Button variant="secondary" className={PUBLIC_TOUCH} onClick={onAgain}>{t('landing.contact.sent.again')}</Button>
    </div>
  )
}

/**
 * Phần "Liên hệ" của trang giới thiệu (`#lien-he`) — lời kêu gọi duy nhất của hai trang công khai: không có nút đăng ký hay mua gói,
 * tài khoản công ty do đội LoadMaster mở sau khi trao đổi. Form chờ danh sách gói đang bán (để chọn sẵn gói trên URL `?goi=`); đọc
 * gói lỗi thì form vẫn dùng được, chỉ không có gói để chọn.
 */
export function ContactSection() {
  const t = useT()
  const [searchParams] = useSearchParams()
  const plans = usePublicPlansQuery()
  const [sent, setSent] = useState<GuestContact | null>(null)
  // Gửi yêu cầu khác: form mới, chọn sẵn như lúc mở trang
  const [round, setRound] = useState(0)

  return (
    <section id={CONTACT_ANCHOR} aria-labelledby="landing-contact" className="scroll-mt-24 px-4 py-14 md:px-shell lg:py-18">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-12">
        <div className="flex flex-col gap-6">
          <SectionHeading id="landing-contact" title={t('landing.contact.title')} lede={t('landing.contact.lede')} />
          <p className="m-0 flex items-start gap-3 text-body text-ink-2 pointer-coarse:text-body-lg">
            <Building2 aria-hidden className="mt-0.5 size-5 flex-none text-primary" strokeWidth={1.5} />
            {t('landing.contact.signUpNote')}
          </p>
        </div>

        <Card className="p-5 sm:p-6">
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
    </section>
  )
}
