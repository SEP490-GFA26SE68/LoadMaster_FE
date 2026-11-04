import { Link } from 'react-router'
import { ROLE_ICON } from '@/components/RoleBadge'
import { SKY_FOCUS } from '@/components/sky-focus'
import { Button } from '@/components/ui/Button'
import { PUBLIC_HOME, PUBLIC_PRICING } from '@/features/auth/landing'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { CONTACT_ANCHOR } from './contact-form'
import { LandingStage } from './LandingStage'
import { PUBLIC_TOUCH } from './public-chrome'

/** Bốn vai trò vận hành làm việc trên cùng một phương án, theo thứ tự của chuyến hàng. */
const HERO_ROLES = ['dispatcher', 'warehouse', 'driver', 'manager'] as const

/**
 * Phần mở đầu của trang giới thiệu, trên nền tối nối liền với đầu trang: tiêu đề, một câu mô tả, nút chính duy nhất của trang "Nhận
 * tư vấn" (cuộn tới form liên hệ) và nút kính "Xem bảng giá" — vòng focus `--cyan-300` như mọi điều khiển trên dải trời; bên phải (dưới,
 * khi màn hẹp) là khung 3D của chuyến mẫu (`LandingStage`).
 */
export function LandingHero() {
  const t = useT()
  return (
    <section aria-labelledby="landing-title">
      <div className="relative grid items-center gap-10 px-4 pt-10 pb-16 md:px-shell xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] xl:gap-14 xl:pt-8 xl:pb-20">
        <div className="flex min-w-0 flex-col items-start gap-6">
          <p className="m-0 flex items-center gap-3 text-small font-semibold text-cyan-300 pointer-coarse:text-body-lg">
            <span aria-hidden className="h-px w-8 bg-cyan-300" />
            {t('landing.hero.eyebrow')}
          </p>
          <h1
            id="landing-title"
            className="m-0 max-w-[15em] font-display text-hero font-bold tracking-[-0.02em] text-balance text-sky-text font-stretch-112%"
          >
            {t('landing.hero.title')}
          </h1>
          <p className="m-0 max-w-[36em] text-intro text-sky-text-2">{t('landing.hero.lede')}</p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Button asChild variant="primary" size="lg" className={cn(PUBLIC_TOUCH, SKY_FOCUS)}>
              <Link to={{ pathname: PUBLIC_HOME, hash: `#${CONTACT_ANCHOR}` }}>{t('landing.hero.cta')}</Link>
            </Button>
            <Button asChild variant="glass" size="lg" className={cn(PUBLIC_TOUCH, SKY_FOCUS)}>
              <Link to={PUBLIC_PRICING}>{t('landing.hero.pricing')}</Link>
            </Button>
          </div>
          <div className="flex flex-col gap-3 border-t border-landing-hairline pt-5">
            <p className="m-0 text-small text-sky-text-3 pointer-coarse:text-body-lg">{t('landing.hero.roles')}</p>
            <ul className="m-0 flex list-none flex-wrap gap-x-5 gap-y-2 p-0">
              {HERO_ROLES.map((role) => {
                const Icon = ROLE_ICON[role]
                return (
                  <li key={role} className="flex items-center gap-2 text-body font-medium text-sky-text-2 pointer-coarse:text-body-lg">
                    <Icon aria-hidden className="size-4 text-cyan-300" strokeWidth={1.5} />
                    {t(`roles.${role}`)}
                  </li>
                )
              })}
            </ul>
          </div>
        </div>

        <LandingStage />
      </div>
    </section>
  )
}
