import { ROLE_ICON } from '@/components/RoleBadge'
import { useFormat, useT } from '@/lib/i18n'
import type { Role } from '@/types/user'
import { SectionHeading } from './SectionHeading'

/** Bốn bước của một chuyến hàng, mỗi bước kèm vai trò làm việc đó (ma trận quyền của ứng dụng). */
const STEPS = [
  { key: 'intake', roles: ['dispatcher', 'manager'] },
  { key: 'plan', roles: ['dispatcher'] },
  { key: 'optimize', roles: ['dispatcher'] },
  { key: 'operate', roles: ['warehouse', 'driver', 'dispatcher'] },
] as const satisfies readonly { key: string; roles: readonly Role[] }[]

/**
 * "Cách hoạt động" của trang giới thiệu (`#cach-hoat-dong`): bốn bước của một chuyến hàng, danh sách có thứ tự nối bằng một đường ray.
 * Số 01–04 là hình (ẩn với trình đọc màn hình, danh sách đã đọc thứ tự); tiêu đề mỗi bước mang chữ "Bước n" ẩn để nghe vẫn rõ. Vai trò
 * của bước là chip trong một đoạn văn — không lồng danh sách —, trình đọc màn hình nghe tên vai trò ngăn bằng dấu phẩy.
 */
export function LandingSteps() {
  const t = useT()
  const format = useFormat()
  return (
    <section id="cach-hoat-dong" aria-labelledby="landing-how" className="scroll-mt-24 border-y border-border bg-bg px-4 py-16 md:px-shell lg:py-24">
      <SectionHeading id="landing-how" title={t('landing.how.title')} lede={t('landing.how.lede')} />
      <ol className="m-0 mt-12 grid list-none gap-x-8 gap-y-12 p-0 md:grid-cols-2 xl:grid-cols-4">
        {STEPS.map(({ key, roles }, index) => (
          <li key={key} className="group flex min-w-0 flex-col gap-4">
            <div aria-hidden className="flex items-center gap-4">
              <span className="font-display text-figure font-bold text-primary tabular-nums font-stretch-112%">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="h-px flex-1 bg-border group-last:hidden" />
              <span className="size-2 flex-none rounded-full bg-cyan-400 group-last:hidden" />
            </div>
            <h3 className="m-0 font-display text-h2 font-[650] tracking-[-0.2px] text-ink-strong font-stretch-108%">
              <span className="sr-only">{t('landing.how.step', { number: index + 1 })}: </span>
              {t(`landing.how.steps.${key}.title`)}
            </h3>
            <p className="m-0 text-body-lg text-ink-2">{t(`landing.how.steps.${key}.text`)}</p>
            <p className="m-0 mt-auto flex flex-wrap items-center gap-2 pt-1">
              <span className="text-small font-medium text-ink-3 pointer-coarse:text-body-lg">{t('landing.how.who')}</span>
              <span className="sr-only">: {format.list(roles.map((role) => t(`roles.${role}`)))}</span>
              {roles.map((role) => {
                const Icon = ROLE_ICON[role]
                return (
                  <span key={role} aria-hidden
                    className="inline-flex items-center gap-1.5 rounded-full bg-tint-slate px-2.5 py-1 text-small font-medium text-tint-slate-fg pointer-coarse:text-body-lg">
                    <Icon className="size-3.5" strokeWidth={1.5} />
                    {t(`roles.${role}`)}
                  </span>
                )
              })}
            </p>
          </li>
        ))}
      </ol>
    </section>
  )
}
