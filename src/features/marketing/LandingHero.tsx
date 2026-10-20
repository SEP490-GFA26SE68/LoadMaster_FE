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
import { Reveal, RevealWords } from './reveal'

/** Bốn vai trò vận hành làm việc trên cùng một phương án, theo thứ tự của chuyến hàng. */
const HERO_ROLES = ['dispatcher', 'warehouse', 'driver', 'manager'] as const

/**
 * Phần mở đầu của trang giới thiệu, trên nền tối nối liền với đầu trang. Cột chữ (544 px từ 1.280 px): dòng mở, tiêu đề, một câu mô tả,
 * nút chính duy nhất của trang "Nhận tư vấn" (cuộn tới form liên hệ), nút kính "Xem bảng giá" — vòng focus `--cyan-300` như mọi điều khiển
 * trên dải trời — và bốn vai trò. Cột phải (dưới, khi màn hẹp hơn 1.280 px) là khung 3D kể chuyện của chuyến mẫu (`LandingStage`).
 *
 * Cột chữ hiện ra một lần ngay khi mở trang (một cổng chung, mốc tính từ lúc cổng mở): dòng mở mở ngang kèm vạch kéo (0 ms), tiêu đề nhô
 * lên từng từ (80 ms), câu mô tả đậm dần (350 ms), hàng nút (500 ms), hàng vai trò hiện dần rồi từng biểu tượng bật nhẹ cách nhau 70 ms
 * (650 ms). Giảm chuyển động, jsdom: đúng các phần tử như không có chuyển động nào.
 */
export function LandingHero() {
  const t = useT()
  return (
    <section aria-labelledby="landing-title">
      <div className="relative grid items-center gap-10 px-4 pt-10 pb-16 md:px-shell xl:grid-cols-[34rem_minmax(0,1fr)] xl:gap-6 xl:pt-8 xl:pb-16">
        <Reveal group className="flex min-w-0 flex-col items-start gap-6 xl:self-center">
          <Reveal as="p" kind="wipe" className="m-0 flex items-center gap-3 text-small font-semibold text-cyan-300 pointer-coarse:text-body-lg">
            <Reveal as="span" kind="fill-x" aria-hidden className="h-px w-8 bg-cyan-300" />
            {t('landing.hero.eyebrow')}
          </Reveal>
          <RevealWords as="h1" id="landing-title" mode="rise" delay={80} text={t('landing.hero.title')}
            className="m-0 max-w-[15em] font-display text-hero font-bold tracking-[-0.02em] text-balance text-sky-text font-stretch-112%" />
          <RevealWords as="p" mode="ink" delay={350} text={t('landing.hero.lede')} className="m-0 max-w-[36em] text-intro text-sky-text-2" />
          <Reveal kind="rise" delay={500} className="flex flex-wrap gap-3 pt-1">
            <Button asChild variant="primary" size="lg" className={cn(PUBLIC_TOUCH, SKY_FOCUS)}>
              <Link to={{ pathname: PUBLIC_HOME, hash: `#${CONTACT_ANCHOR}` }}>{t('landing.hero.cta')}</Link>
            </Button>
            <Button asChild variant="glass" size="lg" className={cn(PUBLIC_TOUCH, SKY_FOCUS)}>
              <Link to={PUBLIC_PRICING}>{t('landing.hero.pricing')}</Link>
            </Button>
          </Reveal>
          <Reveal kind="fade" delay={650} className="flex flex-col gap-3 border-t border-landing-hairline pt-5">
            <p className="m-0 text-small text-sky-text-3 pointer-coarse:text-body-lg">{t('landing.hero.roles')}</p>
            <ul className="m-0 flex list-none flex-wrap gap-x-5 gap-y-2 p-0">
              {HERO_ROLES.map((role, index) => {
                const Icon = ROLE_ICON[role]
                return (
                  <li key={role} className="flex items-center gap-2 text-body font-medium text-sky-text-2 pointer-coarse:text-body-lg">
                    <Reveal as="span" kind="pop" delay={200} index={index} className="flex">
                      <Icon aria-hidden className="size-4 text-cyan-300" strokeWidth={1.5} />
                    </Reveal>
                    {t(`roles.${role}`)}
                  </li>
                )
              })}
            </ul>
          </Reveal>
        </Reveal>

        <LandingStage />
      </div>
    </section>
  )
}
