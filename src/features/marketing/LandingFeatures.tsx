import { Boxes, Route, Users, type LucideIcon } from 'lucide-react'
import { ROLE_ICON } from '@/components/RoleBadge'
import { Card } from '@/components/ui/Card'
import { useT, type MessageKey } from '@/lib/i18n'
import type { Role } from '@/types/user'
import { SectionHeading } from './SectionHeading'

const FEATURES: readonly { icon: LucideIcon; titleKey: MessageKey; textKey: MessageKey }[] = [
  { icon: Boxes, titleKey: 'landing.features.loading.title', textKey: 'landing.features.loading.text' },
  { icon: Route, titleKey: 'landing.features.route.title', textKey: 'landing.features.route.text' },
]

/** Bốn vai trò cùng làm trên một phương án (tên vai trò lấy từ nhánh `roles`, icon là thiết bị của vai trò). */
const ROLES = ['dispatcher', 'warehouse', 'driver', 'companyManager'] as const satisfies readonly Role[]

function IconTile({ icon: Icon, tone }: { icon: LucideIcon; tone: 'blue' | 'slate' }) {
  return (
    <span
      aria-hidden
      className={
        tone === 'blue'
          ? 'grid size-10 flex-none place-items-center rounded-md bg-tint-blue text-tint-blue-fg'
          : 'grid size-10 flex-none place-items-center rounded-md bg-tint-slate text-tint-slate-fg'
      }
    >
      <Icon className="size-5" strokeWidth={1.5} />
    </span>
  )
}

/**
 * "Tính năng chính" của trang giới thiệu (`#tinh-nang`): hai thẻ nền đặc — xếp hàng 3D theo điểm giao, tối ưu tuyến và giám sát — và một
 * thẻ rộng cho bốn vai trò. Chỉ nói điều ứng dụng làm được, không số liệu.
 */
export function LandingFeatures() {
  const t = useT()
  return (
    <section id="tinh-nang" aria-labelledby="landing-features" className="scroll-mt-24 px-4 py-14 md:px-shell lg:py-18">
      <SectionHeading id="landing-features" title={t('landing.features.title')} lede={t('landing.features.lede')} />

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        {FEATURES.map(({ icon, titleKey, textKey }) => (
          <Card key={titleKey} className="flex gap-4 p-5 sm:p-6">
            <IconTile icon={icon} tone="blue" />
            <div className="flex min-w-0 flex-col gap-1.5">
              <h3 className="m-0 font-display text-h3 leading-5.5 font-[650] text-ink-strong font-stretch-106%">{t(titleKey)}</h3>
              <p className="m-0 text-body text-ink-2 pointer-coarse:text-body-lg">{t(textKey)}</p>
            </div>
          </Card>
        ))}
      </div>

      <Card className="mt-4 flex flex-col gap-5 p-5 sm:p-6">
        <div className="flex gap-4">
          <IconTile icon={Users} tone="blue" />
          <div className="flex min-w-0 flex-col gap-1.5">
            <h3 className="m-0 font-display text-h3 leading-5.5 font-[650] text-ink-strong font-stretch-106%">{t('landing.features.roles.title')}</h3>
            <p className="m-0 text-body text-ink-2 pointer-coarse:text-body-lg">{t('landing.features.roles.text')}</p>
          </div>
        </div>
        <ul className="m-0 grid list-none gap-3 border-t border-line-soft p-0 pt-5 sm:grid-cols-2 xl:grid-cols-4">
          {ROLES.map((role) => (
            <li key={role} className="flex gap-3">
              <IconTile icon={ROLE_ICON[role]} tone="slate" />
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-body font-semibold text-ink-strong pointer-coarse:text-body-lg">{t(`roles.${role}`)}</span>
                <span className="text-small text-ink-2 pointer-coarse:text-body-lg">{t(`landing.features.roleList.${role}`)}</span>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  )
}
