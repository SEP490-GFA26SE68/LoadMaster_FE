import { ArrowRight } from 'lucide-react'
import { Link, useLocation } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useT } from '@/lib/i18n'
import { SITE_INFO } from '@/lib/site-info'
import { cn } from '@/lib/utils'
import { contactPath } from '../contact-form'
import { mailtoHref, telHref } from '../footer/footer-links'
import { PUBLIC_TOUCH } from '../public-chrome'
import { LEGAL_PATHS, type LegalDoc } from './legal-facts'

const CARD = 'flex flex-col items-start gap-3 p-5 sm:p-6 print:border-0 print:p-0 print:shadow-none'
const TITLE = 'm-0 font-display text-h3 font-[650] text-ink-strong font-stretch-106%'
const TEXT = 'm-0 text-body-lg text-pretty text-ink-2'
const LINK = 'font-medium text-primary underline underline-offset-2 hover:text-primary-hover'

/** Thẻ dẫn sang tài liệu pháp lý còn lại. */
function RelatedCard({ doc }: { doc: LegalDoc }) {
  const t = useT()
  const { search } = useLocation()
  const other = doc === 'privacy' ? 'terms' : 'privacy'
  return (
    <Card className={cn(CARD, 'print:hidden')}>
      <h2 className={TITLE}>{t('legal.related.title')}</h2>
      <p className={TEXT}>{t(`legal.related.${other}`)}</p>
      <Button asChild variant="secondary" size="lg" className={cn('mt-auto', PUBLIC_TOUCH)}>
        <Link to={{ pathname: LEGAL_PATHS[other], search }}>
          {t(`legal.related.${other}Action`)}
          <ArrowRight aria-hidden strokeWidth={1.5} />
        </Link>
      </Button>
    </Card>
  )
}

/**
 * Thẻ "Còn câu hỏi?": lối hỏi là form liên hệ của trang giới thiệu. Email, điện thoại, địa chỉ, mã số thuế chỉ hiện khi `SITE_INFO` có
 * (hôm nay cả bốn để trống nên không có dòng nào) — điền ở `lib/site-info.ts` là hai trang tự hiện.
 */
function ClosingCard() {
  const t = useT()
  const { supportEmail, phone, address, taxCode } = SITE_INFO
  return (
    <Card className={CARD}>
      <h2 className={TITLE}>{t('legal.closing.title')}</h2>
      <p className={TEXT}>{t('legal.closing.body')}</p>
      {supportEmail === null ? null : (
        <p className={TEXT}>
          <a href={mailtoHref(supportEmail)} className={LINK}>{t('legal.closing.email', { email: supportEmail })}</a>
        </p>
      )}
      {phone === null ? null : (
        <p className={TEXT}>
          <a href={telHref(phone)} className={LINK}>{t('legal.closing.phone', { phone })}</a>
        </p>
      )}
      {address === null ? null : <p className={TEXT}>{t('legal.closing.address', { address })}</p>}
      {taxCode === null ? null : <p className={TEXT}>{t('legal.closing.taxCode', { code: taxCode })}</p>}
      <Button asChild variant="secondary" size="lg" className={cn('mt-auto print:hidden', PUBLIC_TOUCH)}>
        <Link to={contactPath({ type: 'INQUIRY' })}>
          {t('legal.closing.action')}
          <ArrowRight aria-hidden strokeWidth={1.5} />
        </Link>
      </Button>
    </Card>
  )
}

/** Hai thẻ cuối trang pháp lý: đọc cùng tài liệu kia, và lối hỏi. Không nút chính — cả hai là nút phụ. */
export function LegalFooterCards({ doc }: { doc: LegalDoc }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <RelatedCard doc={doc} />
      <ClosingCard />
    </div>
  )
}
