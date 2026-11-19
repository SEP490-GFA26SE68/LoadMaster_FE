import type { ReactNode } from 'react'
import { ROLE_ICON } from '@/components/RoleBadge'
import { Card } from '@/components/ui/Card'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { Role } from '@/types/user'
import { DeadlineChips, PlansVisual, VerifyVisual } from './bento/FeatureVisuals'
import { PickupVisual, RouteVisual } from './bento/MapVisuals'
import { ZoneDiagram } from './bento/ZoneDiagram'
import { LineRise, Reveal, RevealWords } from './reveal'
import { SectionHeading } from './SectionHeading'

/** Bốn vai trò cùng làm trên một phương án (tên vai trò lấy từ nhánh `roles`, icon là thiết bị của vai trò). */
const ROLES = ['dispatcher', 'warehouse', 'driver', 'companyManager'] as const satisfies readonly Role[]

const TILE_TITLE = 'm-0 font-display text-h2 font-[650] tracking-[-0.2px] font-stretch-108%'
const TILE_TEXT = 'm-0 text-body-lg'

/**
 * Một ô của lưới tính năng: tiêu đề, một câu, rồi hình minh hoạ dồn xuống đáy ô. Ô tối là thẻ nền tối đặc như thẻ xem trước 3D. Mỗi ô là
 * một cổng hiện ra riêng (nhô lên một lần khi chính nó cuộn tới), `index` so le các ô cùng hàng 70 ms một bậc; tiêu đề nhô lên khỏi mặt
 * nạ (`LineRise`), câu của ô đậm dần — theo mốc của ô. `at`: ngưỡng lộ riêng của ô cao hơn ô cùng hàng, để hai ô mở cùng lúc.
 */
function Tile({ title, text, dark = false, index, at, className, children }: {
  title: string
  text: string
  dark?: boolean
  index: number
  at?: number
  className?: string
  children: ReactNode
}) {
  const body = (
    <>
      <div className="flex flex-col gap-2">
        <LineRise as="h3" delay={80} lines={[title]} className={cn(TILE_TITLE, dark ? 'text-sky-text' : 'text-ink-strong')} />
        <RevealWords as="p" mode="ink" delay={220} text={text} className={cn(TILE_TEXT, dark ? 'text-sky-text-2' : 'text-ink-2')} />
      </div>
      <div className="mt-auto">{children}</div>
    </>
  )
  return (
    <Reveal index={index} at={at} className={cn('flex min-w-0 flex-col', className)}>
      {dark ? (
        <div className="flex min-w-0 flex-1 flex-col gap-6 rounded-lg border border-border-dark bg-panel-dark p-5 sm:p-7">{body}</div>
      ) : (
        <Card className="flex min-w-0 flex-1 flex-col gap-5 p-5 sm:p-6">{body}</Card>
      )}
    </Reveal>
  )
}

/**
 * "Tính năng chính" của trang giới thiệu (`#tinh-nang`), lưới ô kích thước khác nhau: ô lớn nền tối cho xếp hàng 3D theo vùng điểm giao
 * (sơ đồ đẳng cự), rồi ba phương án một lần chạy, đối chiếu kiện ba mức, tối ưu tuyến và giám sát, nhận hàng dọc đường; cuối là dải bốn
 * vai trò. Hình là SVG trang trí — chữ của từng ô đã nói điều hình vẽ; không số liệu, không giờ đến nghĩ ra. Cuộn tới thì các ô nhô lên
 * so le một lần, bốn vai trò hiện cách nhau 70 ms; chuyển động tắt thì mọi thứ đứng sẵn.
 */
export function LandingFeatures() {
  const t = useT()
  return (
    <section id="tinh-nang" aria-labelledby="landing-features" className="scroll-mt-24 px-4 py-16 md:px-shell lg:py-24">
      <SectionHeading id="landing-features" title={t('landing.features.title')} lede={t('landing.features.lede')} />

      <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-5">
        {/* Ô tối cao hai hàng (từ 1.024 px) cạnh ô một hàng: 7 % của nó ≈ 15 % của ô bên cạnh, hai ô hiện cùng lúc */}
        <Tile dark index={0} at={0.07} title={t('landing.features.loading.title')} text={t('landing.features.loading.text')} className="md:col-span-2 lg:row-span-2">
          <ZoneDiagram />
        </Tile>
        <Tile index={1} title={t('landing.features.plans.title')} text={t('landing.features.plans.text')}>
          <PlansVisual />
        </Tile>
        <Tile index={2} title={t('landing.features.verify.title')} text={t('landing.features.verify.text')}>
          <VerifyVisual />
        </Tile>
        <Tile index={0} title={t('landing.features.route.title')} text={t('landing.features.route.text')} className="md:col-span-2">
          <div className="flex flex-col gap-4">
            <RouteVisual />
            <DeadlineChips />
          </div>
        </Tile>
        <Tile index={1} title={t('landing.features.pickup.title')} text={t('landing.features.pickup.text')} className="md:col-span-2 lg:col-span-1">
          <PickupVisual />
        </Tile>

        <Reveal className="flex min-w-0 flex-col md:col-span-2 lg:col-span-3">
          <Card className="flex flex-1 flex-col gap-6 p-5 sm:p-6">
            <div className="flex max-w-180 flex-col gap-2">
              <LineRise as="h3" delay={80} lines={[t('landing.features.roles.title')]} className={cn(TILE_TITLE, 'text-ink-strong')} />
              <RevealWords as="p" mode="ink" delay={220} text={t('landing.features.roles.text')} className={cn(TILE_TEXT, 'text-ink-2')} />
            </div>
            <ul className="m-0 grid list-none gap-5 border-t border-line-soft p-0 pt-6 sm:grid-cols-2 xl:grid-cols-4">
              {ROLES.map((role, index) => {
                const Icon = ROLE_ICON[role]
                return (
                  <Reveal as="li" key={role} index={index} delay={150} className="flex gap-3">
                    <Reveal as="span" kind="pop" delay={150} aria-hidden className="grid size-10 flex-none place-items-center rounded-md bg-tint-blue text-tint-blue-fg">
                      <Icon className="size-5" strokeWidth={1.5} />
                    </Reveal>
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-body-lg font-semibold text-ink-strong">{t(`roles.${role}`)}</span>
                      <span className="text-body text-ink-2 pointer-coarse:text-body-lg">{t(`landing.features.roleList.${role}`)}</span>
                    </div>
                  </Reveal>
                )
              })}
            </ul>
          </Card>
        </Reveal>
      </div>
    </section>
  )
}
