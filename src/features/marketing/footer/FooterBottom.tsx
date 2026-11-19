import { ArrowUp } from 'lucide-react'
import { SKY_FOCUS } from '@/components/sky-focus'
import { Button } from '@/components/ui/Button'
import { useT } from '@/lib/i18n'
import { SITE_INFO } from '@/lib/site-info'
import { cn } from '@/lib/utils'
import { PUBLIC_TOUCH } from '../public-chrome'
import { scrollToPageTop } from './back-to-top'

/**
 * Hàng cuối của chân trang: bản quyền (năm theo đồng hồ của máy — truyền chuỗi để không nhóm số thành "2.026"), mã số thuế khi
 * `SITE_INFO` có, dòng ghi công thiết kế và
 * nút "Lên đầu trang".
 */
export function FooterBottom() {
  const t = useT()
  const year = String(new Date().getFullYear())
  return (
    <div className="flex flex-col gap-5 border-t border-landing-hairline pt-6 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
      <div className="flex min-w-0 flex-col gap-2">
        <p className="m-0 flex flex-wrap gap-x-4 gap-y-1 text-small font-medium text-sky-text pointer-coarse:text-body-lg">
          <span>{t('landingFooter.copyright', { year, name: SITE_INFO.name })}</span>
          {SITE_INFO.taxCode ? <span className="font-normal text-sky-text-3">{t('landingFooter.taxCode', { code: SITE_INFO.taxCode })}</span> : null}
        </p>
        <p className="m-0 max-w-200 text-small text-pretty text-sky-text-3 pointer-coarse:text-body-lg">{t('landingFooter.credit')}</p>
      </div>
      <Button variant="glass" className={cn('h-11 self-start lg:self-center', PUBLIC_TOUCH, SKY_FOCUS)} onClick={scrollToPageTop}>
        <ArrowUp aria-hidden strokeWidth={1.5} />
        {t('landingFooter.backToTop')}
      </Button>
    </div>
  )
}
