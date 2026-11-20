import { useMemo, type ReactNode } from 'react'
import { Smartphone } from 'lucide-react'
import { ROLE_ICON } from '@/components/RoleBadge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { useFormat, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Reveal } from '../reveal'
import { SectionHeading } from '../SectionHeading'
import { DispatcherScreen } from './DispatcherScreen'
import { DriverScreen } from './DriverScreen'
import { ManagerScreen } from './ManagerScreen'
import { ROLE_DEVICE, ROLE_TABS, roleCargo, roleRoute, type RoleCargo, type RoleRoute, type RoleTab } from './roles-model'
import { WarehouseScreen } from './WarehouseScreen'
import './roles.css'

/** Hai ý của mỗi tab, theo thứ tự. */
const POINTS = ['p1', 'p2'] as const

/** Bề rộng tối đa của khung theo thiết bị; máy tính bảng hẹp lại dưới 640 px, điện thoại dưới 1.024 px đứng cạnh hai ý thay vì nằm trên. */
const FRAME_WIDTH: Readonly<Record<RoleTab, string>> = {
  dispatcher: 'max-w-180',
  warehouse: 'max-w-72 sm:max-w-150',
  driver: 'max-w-64',
  companyManager: 'max-w-180',
}

function screenOf(role: RoleTab, route: RoleRoute, cargo: RoleCargo): ReactNode {
  switch (role) {
    case 'dispatcher': return <DispatcherScreen route={route} />
    case 'warehouse': return <WarehouseScreen cargo={cargo} />
    case 'driver': return <DriverScreen route={route} cargo={cargo} />
    case 'companyManager': return <ManagerScreen cargo={cargo} />
  }
}

/**
 * "Một chuyến, bốn màn" (`#vai-tro`), ngay sau "Một chuyến hàng trên LoadMaster": bốn vai trò của một chuyến trong một nhóm tab (Radix);
 * mỗi tab là một khung thiết bị dựng lại màn thật của vai trò đó (`DeviceFrame` + màn thu nhỏ, `aria-hidden`, kèm bản chữ tương đương)
 * và hai ý. Bốn bảng luôn được dựng (`forceMount`) và chồng lên một ô lưới (`roles.css`): phần cao bằng bảng cao nhất, đổi tab không làm
 * trang nhảy, bảng không mở thì ẩn hẳn. Tab dưới 640 px là lưới 2 × 2 cao 56 px. Câu về ứng dụng di động của tài xế và nhân viên kho
 * nằm trong tab tài xế, dưới hai ý — một câu chữ, không huy hiệu tải, không liên kết cửa hàng. Số trong hình tính từ chuyến mẫu và tuyến mẫu
 * (`roles-model.ts`), kèm một câu nguồn; không nhãn MOCK RESULT, không nút chính.
 */
export function LandingRoles() {
  const t = useT()
  const format = useFormat()
  const route = useMemo(() => roleRoute(), [])
  const cargo = useMemo(() => roleCargo(), [])
  return (
    <section id="vai-tro" aria-labelledby="landing-roles" className="scroll-mt-24 border-t border-border bg-bg px-4 py-8 md:px-shell lg:py-16">
      <SectionHeading id="landing-roles" title={t('landingRoles.title')} lede={t('landingRoles.lede')} />
      <Tabs defaultValue={ROLE_TABS[0]} className="mt-6 lg:mt-8">
        <TabsList
          data-tone="roles"
          aria-label={t('landingRoles.tabsLabel')}
          className="grid grid-cols-2 gap-2 border-0 px-0 sm:flex sm:flex-wrap"
        >
          {ROLE_TABS.map((role) => {
            const Icon = ROLE_ICON[role]
            return (
              <TabsTrigger
                key={role}
                value={role}
                className={cn(
                  'h-14 min-w-0 justify-start gap-2.5 rounded-lg border border-border bg-bg px-3 text-body-lg text-ink-2 sm:px-4',
                  'hover:border-line-strong data-[state=active]:border-primary data-[state=active]:bg-primary-bg data-[state=active]:text-ink-strong',
                )}
              >
                <Icon aria-hidden className="size-5 flex-none text-primary" strokeWidth={1.5} />
                <span className="min-w-0 text-left text-pretty whitespace-normal">{t(`roles.${role}`)}</span>
              </TabsTrigger>
            )
          })}
        </TabsList>
        <div className="roles-panels mt-5 lg:mt-8">
          {ROLE_TABS.map((role) => {
            const phone = ROLE_DEVICE[role] === 'phone'
            return (
              <TabsContent
                key={role}
                value={role}
                forceMount
                className={cn(
                  'grid min-w-0 content-start gap-5 outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary',
                  'lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-center lg:gap-14',
                  phone && 'grid-cols-[minmax(0,9rem)_minmax(0,1fr)] items-center gap-4 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]',
                )}
              >
                <Reveal kind="fade" className={cn('w-full min-w-0 justify-self-center', FRAME_WIDTH[role])}>
                  {screenOf(role, route, cargo)}
                </Reveal>
                <div className="flex min-w-0 flex-col gap-3">
                  <p className="m-0 text-small font-semibold text-ink-3 pointer-coarse:text-body-lg">{t(`landingRoles.screens.${role}`)}</p>
                  <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                    {POINTS.map((point) => (
                      <li key={point} className="flex gap-2.5 text-body-lg text-pretty text-ink-1">
                        <span aria-hidden className="mt-2.5 size-1.5 flex-none rounded-full bg-cyan-500" />
                        {t(`landingRoles.points.${role}.${point}`)}
                      </li>
                    ))}
                  </ul>
                  {role === 'driver' ? (
                    <p className="m-0 flex gap-2.5 text-body-lg text-pretty text-ink-1">
                      <Smartphone aria-hidden className="mt-0.5 size-5 flex-none text-primary" strokeWidth={1.5} />
                      {t('landingRoles.mobileApp')}
                    </p>
                  ) : null}
                </div>
              </TabsContent>
            )
          })}
        </div>
      </Tabs>
      <p className="m-0 mt-6 max-w-[52em] text-small text-pretty text-ink-3 pointer-coarse:text-body-lg">
        {t('landingRoles.source', { count: format.integer(cargo.packageCount), time: format.time(route.departureTime) })}
      </p>
    </section>
  )
}
