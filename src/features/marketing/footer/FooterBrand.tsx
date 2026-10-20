import { ArrowRight, Mail, MapPin, Phone, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Logo } from '@/components/brand/Logo'
import { LanguageMenu } from '@/components/LanguageMenu'
import { SKY_FOCUS } from '@/components/sky-focus'
import { Button } from '@/components/ui/Button'
import { LOCALE_NAMES, useLocale, useT } from '@/lib/i18n'
import { SITE_INFO } from '@/lib/site-info'
import { cn } from '@/lib/utils'
import { PUBLIC_TOUCH } from '../public-chrome'
import { RevealWords } from '../reveal'
import { CONTACT_LINK, mailtoHref, telHref } from './footer-links'
import { FOOTER_LINK, FOOTER_TEXT } from './footer-styles'

/** Một dòng liên hệ: ô biểu tượng, nhãn nhỏ, rồi giá trị (liên kết hoặc chữ). */
function ContactRow({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span aria-hidden className="mt-1 grid size-9 flex-none place-items-center rounded-md border border-landing-hairline bg-sky-glass text-cyan-300">
        <Icon className="size-4" strokeWidth={1.5} />
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="text-small text-sky-text-3 pointer-coarse:text-body-lg">{label}</span>
        {children}
      </div>
    </div>
  )
}

/**
 * Khối thương hiệu của chân trang: logo kèm khẩu hiệu, một câu nói LoadMaster làm gì, thông tin liên hệ (`<address>`) và hai điều khiển —
 * lối gửi yêu cầu tư vấn (nút kính, không phải nút chính: trang giới thiệu chỉ có một nút chính ở phần mở đầu) và ngôn ngữ giao diện.
 * Liên hệ chỉ lấy từ `SITE_INFO`: hôm nay chỉ có hộp thư hỗ trợ; điện thoại và địa chỉ hiện ra khi `SITE_INFO` có giá trị thật.
 */
export function FooterBrand({ className }: { className?: string }) {
  const t = useT()
  const { locale } = useLocale()
  const { supportEmail, phone, address } = SITE_INFO
  return (
    <div className={cn('flex min-w-0 flex-col gap-6', className)}>
      <Logo tone="dark" size="md" tagline className="self-start" />
      <RevealWords as="p" mode="ink" delay={120} text={t('landingFooter.description')} className={cn(FOOTER_TEXT, 'max-w-md')} />

      <address className="flex flex-col gap-3 not-italic">
        <ContactRow icon={Mail} label={t('landingFooter.contact.email')}>
          <a href={mailtoHref(supportEmail)} className={cn(FOOTER_LINK, 'self-start break-all')}>{supportEmail}</a>
        </ContactRow>
        {phone ? (
          <ContactRow icon={Phone} label={t('landingFooter.contact.phone')}>
            <a href={telHref(phone)} className={cn(FOOTER_LINK, 'self-start')}>{phone}</a>
          </ContactRow>
        ) : null}
        {address ? (
          <ContactRow icon={MapPin} label={t('landingFooter.contact.address')}>
            <span className="py-1 text-body text-sky-text-2 pointer-coarse:text-body-lg">{address}</span>
          </ContactRow>
        ) : null}
      </address>

      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="glass" className={cn('h-11', PUBLIC_TOUCH, SKY_FOCUS)}>
          <Link to={CONTACT_LINK.to}>
            {t('landingFooter.cta')}
            <ArrowRight aria-hidden strokeWidth={1.5} />
          </Link>
        </Button>
        <span className="flex items-center gap-2">
          <LanguageMenu
            className="h-11 min-w-11 pointer-coarse:h-14 pointer-coarse:min-w-14 pointer-coarse:text-body-lg"
            itemClassName={PUBLIC_TOUCH}
          />
          {/* Tên ngôn ngữ đang dùng, cho người nhìn; nút đã có tên "Ngôn ngữ giao diện" và menu đánh dấu mục đang chọn */}
          <span aria-hidden lang={locale} className="text-small text-sky-text-3 pointer-coarse:text-body-lg">{LOCALE_NAMES[locale]}</span>
        </span>
      </div>
    </div>
  )
}
