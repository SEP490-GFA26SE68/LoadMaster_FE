import { Boxes, GitCompareArrows, PackagePlus, Route, ScanQrCode, UsersRound, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { ROLE_ICON } from '@/components/RoleBadge'
import { Card } from '@/components/ui/Card'
import { PICKUP_RULES } from '@/domain/pickup'
import { useFormat, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { COMPANY_ROLES } from '@/types/user'
import { DeadlineChips, PlansVisual, VerifyVisual } from './bento/FeatureVisuals'
import { PickupVisual, RouteVisual } from './bento/MapVisuals'
import { ZoneDiagram } from './bento/ZoneDiagram'
import { LineRise, Reveal, RevealWords } from './reveal'
import { SectionHeading } from './SectionHeading'

/**
 * Các vai trò của công ty (`COMPANY_ROLES`) theo đường đi của một chuyến: điều phối → kho → tài xế, rồi quản lý và quản trị (tên lấy từ
 * nhánh `roles`). Test của ô canh danh sách này đủ đúng `COMPANY_ROLES`.
 */
export const FEATURE_ROLES = ['dispatcher', 'warehouse', 'driver', 'manager', 'companyAdmin'] as const satisfies readonly (typeof COMPANY_ROLES)[number][]

/**
 * Tiêu đề ô nhô lên khỏi mặt nạ như một dòng (`LineRise` — tiêu đề thẻ trên cả trang dùng cùng kiểu), câu của ô đậm dần — theo mốc của ô.
 */
const TILE_TEXT = 'm-0 text-body-lg text-pretty'

/** Dòng nhãn của ô: biểu tượng trong ô màu nhạt và tên tính năng — tiêu đề bên dưới nói lợi ích. */
function Kicker({ icon: Icon, text, dark }: { icon: LucideIcon; text: string; dark: boolean }) {
  return (
    <p className={cn('m-0 flex items-center gap-2.5 text-small font-semibold pointer-coarse:text-body-lg', dark ? 'text-cyan-300' : 'text-primary')}>
      <span aria-hidden className={cn('grid size-8 flex-none place-items-center rounded-md', dark ? 'border border-border-dark bg-canvas-1' : 'bg-tint-blue text-tint-blue-fg')}>
        <Icon className="size-4" strokeWidth={1.5} />
      </span>
      {text}
    </p>
  )
}

type TileProps = {
  icon: LucideIcon
  kicker: string
  title: string
  text: string
  dark?: boolean
  index: number
  at?: number
  className?: string
  children: ReactNode
}

/**
 * Một ô của lưới: dòng nhãn, tiêu đề, một câu, hình minh hoạ dồn xuống đáy ô; ô tối là thẻ nền tối đặc như thẻ xem trước 3D. Mỗi ô là một
 * cổng hiện ra riêng (nhô lên khi chính nó cuộn tới), `index` so le các ô cùng hàng 70 ms một bậc; chữ và hình bên trong chạy theo mốc của
 * ô. `at`: ngưỡng lộ riêng của ô cao hơn ô cùng hàng, để hai ô mở cùng lúc.
 */
function Tile({ icon, kicker, title, text, dark = false, index, at, className, children }: TileProps) {
  const body = (
    <>
      <div className="flex flex-col gap-3">
        <Kicker icon={icon} text={kicker} dark={dark} />
        <LineRise as="h3" delay={80} lines={[title]}
          className={cn('m-0 font-display font-[650] tracking-[-0.2px] text-balance font-stretch-108%', dark ? 'text-h1 text-sky-text' : 'text-h2 text-ink-strong')} />
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

/** Dải năm vai trò của công ty: từng vai trò nhô lên cách nhau 70 ms, icon (thiết bị của vai trò) bật ra sau đó. */
function RolesTile() {
  const t = useT()
  const format = useFormat()
  return (
    <Reveal className="flex min-w-0 flex-col md:col-span-2 lg:col-span-3">
      <Card className="flex flex-1 flex-col gap-6 p-5 sm:p-6">
        <div className="flex max-w-180 flex-col gap-3">
          <Kicker icon={UsersRound} text={t('landing.features.roles.kicker')} dark={false} />
          <LineRise as="h3" delay={80} lines={[t('landing.features.roles.title', { count: format.integer(COMPANY_ROLES.length) })]}
            className="m-0 font-display text-h2 font-[650] tracking-[-0.2px] text-balance text-ink-strong font-stretch-108%" />
          <RevealWords as="p" mode="ink" delay={220} text={t('landing.features.roles.text')} className={cn(TILE_TEXT, 'text-ink-2')} />
        </div>
        <ul className="m-0 grid list-none gap-5 border-t border-line-soft p-0 pt-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {FEATURE_ROLES.map((role, index) => {
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
  )
}

/**
 * "Tính năng chính" (`#tinh-nang`): ô lớn nền tối cho xếp hàng 3D theo vùng điểm giao, ba phương án, đối chiếu kiện, tuyến và giám sát, nhận
 * hàng dọc đường, dải năm vai trò của công ty. Mỗi ô: dòng nhãn (tên tính năng), tiêu đề nói lợi ích, một câu nói cách làm. Hình là SVG
 * trang trí, không số liệu; số trong chữ (số luật, số vai trò) lấy từ code. Cuộn tới thì các ô nhô lên so le, tiêu đề hiện từng từ, câu đậm
 * dần, hình chạy một lần (vùng hàng hiện từ điểm cuối ra cửa, ô hàng của ba phương án bật ra, tia quét qua mã QR, tuyến vẽ dần rồi xe hiện
 * trên chặng, kiện nhận phồng lên).
 */
export function LandingFeatures() {
  const t = useT()
  const format = useFormat()
  return (
    <section id="tinh-nang" aria-labelledby="landing-features" className="scroll-mt-24 px-4 py-16 md:px-shell lg:py-24">
      <SectionHeading id="landing-features" title={t('landing.features.title')} lede={t('landing.features.lede')} />
      <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-5">
        {/* Ô tối cao hai hàng (từ 1.024 px) cạnh ô một hàng: 7 % của nó ≈ 15 % của ô bên cạnh, hai ô hiện cùng lúc */}
        <Tile dark icon={Boxes} index={0} at={0.07} kicker={t('landing.features.loading.kicker')} title={t('landing.features.loading.title')}
          text={t('landing.features.loading.text')} className="md:col-span-2 lg:row-span-2">
          <ZoneDiagram />
        </Tile>
        <Tile icon={GitCompareArrows} index={1} kicker={t('landing.features.plans.kicker')} title={t('landing.features.plans.title')} text={t('landing.features.plans.text')}>
          <PlansVisual />
        </Tile>
        <Tile icon={ScanQrCode} index={2} kicker={t('landing.features.verify.kicker')} title={t('landing.features.verify.title')} text={t('landing.features.verify.text')}>
          <VerifyVisual />
        </Tile>
        <Tile icon={Route} index={0} kicker={t('landing.features.route.kicker')} title={t('landing.features.route.title')} text={t('landing.features.route.text')}
          className="md:col-span-2">
          <div className="flex flex-col gap-4">
            <RouteVisual />
            <DeadlineChips />
          </div>
        </Tile>
        <Tile icon={PackagePlus} index={1} kicker={t('landing.features.pickup.kicker')} title={t('landing.features.pickup.title')}
          text={t('landing.features.pickup.text', { count: format.integer(PICKUP_RULES.length) })} className="md:col-span-2 lg:col-span-1">
          <PickupVisual />
        </Tile>
        <RolesTile />
      </div>
    </section>
  )
}
