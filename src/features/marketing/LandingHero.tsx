import { Link } from 'react-router'
import { CargoArtwork } from '@/components/CargoArtwork'
import { SKY_FOCUS } from '@/components/sky-focus'
import { Button } from '@/components/ui/Button'
import { PUBLIC_HOME, PUBLIC_PRICING } from '@/features/auth/landing'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { CONTACT_ANCHOR } from './contact-form'
import { PUBLIC_TOUCH } from './public-chrome'

/**
 * Phần mở đầu của trang giới thiệu, trên dải trời nối liền với đầu trang: tiêu đề, một câu mô tả, nút chính duy nhất của trang "Nhận
 * tư vấn" (cuộn tới form liên hệ) và nút kính "Xem bảng giá" — vòng focus `--cyan-300` như mọi điều khiển trên dải trời; bên phải là
 * hình thùng xe xếp đầy một lần (`CargoArtwork`) trong khung tối đặc.
 */
export function LandingHero() {
  const t = useT()
  return (
    <section aria-labelledby="landing-title" className="sky">
      <div className="grid items-center gap-8 px-4 pt-8 pb-14 md:px-shell lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-12 lg:pt-12 lg:pb-20">
        <div className="flex flex-col items-start gap-5">
          <p className="m-0 text-small font-semibold text-cyan-300 pointer-coarse:text-body-lg">{t('landing.hero.eyebrow')}</p>
          <h1
            id="landing-title"
            className="m-0 max-w-160 font-display text-display leading-10 font-bold tracking-[-0.5px] text-pretty text-sky-text font-stretch-112%"
          >
            {t('landing.hero.title')}
          </h1>
          <p className="m-0 max-w-150 text-body-lg text-sky-text-2">{t('landing.hero.lede')}</p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Button asChild variant="primary" className={cn(PUBLIC_TOUCH, SKY_FOCUS)}>
              <Link to={{ pathname: PUBLIC_HOME, hash: `#${CONTACT_ANCHOR}` }}>{t('landing.hero.cta')}</Link>
            </Button>
            <Button asChild variant="glass" className={cn(PUBLIC_TOUCH, SKY_FOCUS)}>
              <Link to={PUBLIC_PRICING}>{t('landing.hero.pricing')}</Link>
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-border-dark bg-canvas-1 p-4 sm:p-5">
          <CargoArtwork label={t('landing.hero.artworkLabel')} className="max-h-[42vh]" />
        </div>
      </div>
    </section>
  )
}
