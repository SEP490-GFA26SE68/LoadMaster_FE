import { Link } from 'react-router'
import { ROLE_ICON } from '@/components/RoleBadge'
import { SKY_FOCUS } from '@/components/sky-focus'
import { Button } from '@/components/ui/Button'
import { useAuthSafe } from '@/features/auth/AuthProvider'
import { PUBLIC_HOME, PUBLIC_PRICING, TRIAL_REGISTRATION } from '@/features/auth/landing'
import { REGISTRATION_CAPABILITIES } from '@/features/registration/useRegistrationQuery'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { CONTACT_ANCHOR } from './contact-form'
import { LandingStage } from './LandingStage'
import { PUBLIC_TOUCH } from './public-chrome'
import { FlowHeading, Reveal, RevealWords } from './reveal'

/** Bốn vai trò vận hành làm việc trên cùng một phương án, theo thứ tự của chuyến hàng. */
const HERO_ROLES = ['dispatcher', 'warehouse', 'driver', 'companyManager'] as const

/**
 * Phần mở đầu của trang giới thiệu, trên nền tối nối liền với đầu trang: tiêu đề, một câu mô tả, nút chính duy nhất của trang và nút kính
 * "Xem bảng giá" — vòng focus `--cyan-300` như mọi điều khiển trên dải trời; bên phải (dưới, khi màn hẹp) là khung 3D của chuyến mẫu
 * (`LandingStage`). Khi nối backend (`REGISTRATION_CAPABILITIES`) và khách chưa đăng nhập, nút chính là "Đăng ký trải nghiệm" — lối vào dễ
 * thấy nhất của luồng dùng thử — và "Nhận tư vấn" (cuộn tới form liên hệ) lùi thành nút kính; kho mẫu không có luồng đăng ký nên nút chính
 * vẫn là "Nhận tư vấn". Trên trang giới thiệu (trong `RevealProvider`) cột chữ là một cổng hiện một lần: dòng mở đầu chảy từng chữ sau
 * vạch cyan, tiêu đề nhô lên từng từ, câu mô tả đậm dần, rồi hàng nút và hàng vai trò; tên truy cập của tiêu đề và vùng không đổi.
 * Từ 1.280 px cột phải (khung 3D, thứ tự giao, ba phương án, kết quả) cao hơn một màn hình: cột chữ bám đầu lưới — nút chính nằm trong màn
 * đầu — và dính dưới đầu trang trong lúc khách cuộn qua cột phải, khi màn đủ cao (từ 704 px) để cả cột chữ vừa.
 */
export function LandingHero() {
  const t = useT()
  const user = useAuthSafe()?.user
  const signUp = REGISTRATION_CAPABILITIES.publicSignUp && !user
  return (
    <section aria-labelledby="landing-title">
      <div className="relative grid items-center gap-10 px-4 pt-10 pb-16 md:px-shell xl:grid-cols-[34rem_minmax(0,1fr)] xl:items-start xl:gap-6 xl:pt-8 xl:pb-16">
        <Reveal group className="flex min-w-0 flex-col items-start gap-6 xl:pt-10 xl:[@media(min-height:44rem)]:sticky xl:[@media(min-height:44rem)]:top-16">
          <FlowHeading
            as="p"
            text={t('landing.hero.eyebrow')}
            className="m-0 flex items-center gap-3 text-small font-semibold text-cyan-300 pointer-coarse:text-body-lg"
            before={<Reveal as="span" kind="fill-x" aria-hidden className="h-px w-8 flex-none bg-cyan-300" />}
          />
          <RevealWords
            as="h1"
            id="landing-title"
            mode="rise"
            delay={80}
            text={t('landing.hero.title')}
            className="m-0 max-w-[15em] font-display text-hero font-bold tracking-[-0.02em] text-balance text-sky-text font-stretch-112%"
          />
          <RevealWords as="p" mode="ink" delay={350} text={t('landing.hero.lede')} className="m-0 max-w-[36em] text-intro text-sky-text-2" />
          <Reveal kind="rise" delay={500} className="flex flex-wrap gap-3 pt-1">
            {signUp ? (
              <Button asChild variant="primary" size="lg" className={cn(PUBLIC_TOUCH, SKY_FOCUS)}>
                <Link to={TRIAL_REGISTRATION}>{t('landing.header.trial')}</Link>
              </Button>
            ) : null}
            <Button asChild variant={signUp ? 'glass' : 'primary'} size="lg" className={cn(PUBLIC_TOUCH, SKY_FOCUS)}>
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
                    <Reveal as="span" kind="pop" delay={200} index={index} aria-hidden className="flex">
                      <Icon className="size-4 text-cyan-300" strokeWidth={1.5} />
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
