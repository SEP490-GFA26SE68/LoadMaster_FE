import { Check, ChevronDown, MoreHorizontal } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { Link, matchPath, NavLink, useLocation } from 'react-router'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/DropdownMenu'
import { useGlassFollow } from '@/components/useGlassFollow'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { visibleNavCount } from './nav-overflow'

export type NavTrayItem = { readonly to: string; readonly label: string; readonly icon: LucideIcon }

/** Khung chung của mục và nút "Thêm": bản đo ẩn dựng đúng khung này nên đo ra đúng bề rộng của phần tử thật. */
const ITEM = 'relative z-1 flex h-9 items-center gap-1.5 rounded-md px-2 text-body whitespace-nowrap 2xl:gap-2 2xl:px-3.5'
const INTERACTIVE = cn(
  'transition-colors duration-(--dur-fast) ease-standard',
  'outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-cyan-300',
)
/** Dưới 1.340 px mục chỉ còn icon, tên nằm ở `aria-label`. */
const LABEL = 'hidden min-[1340px]:inline'
/** Mục đang mở hoặc nút "Thêm" đang chứa mục đang mở: chỉ báo kính nghỉ ở đó khi con trỏ rời thanh. */
const GLASS_ACTIVE = '[aria-current="page"], [data-nav-current]'

const endOf = (to: string) => to === '/' || to === '/kho'
const px = (value: string) => Number.parseFloat(value) || 0

type BodyProps = { icon: LucideIcon; label: string; active: boolean; ghost?: boolean }

/**
 * Icon + tên của một mục. `ghost` (bản đo): tên vẽ bằng `::before` từ `data-label` — đo ra đúng bề rộng mà không thêm chữ vào DOM, nên
 * tìm theo chữ (test, công cụ hỗ trợ) chỉ thấy mục thật.
 */
function ItemBody({ icon: Icon, label, active, ghost = false }: BodyProps) {
  return (
    <>
      <Icon className={cn('size-4.5 flex-none', active ? 'text-cyan-200' : 'opacity-80')} strokeWidth={active ? 2 : 1.5} aria-hidden />
      {ghost ? <span data-label={label} className={cn(LABEL, 'before:content-[attr(data-label)]')} /> : <span className={LABEL}>{label}</span>}
    </>
  )
}

function MoreBody({ current, label, ghost }: { current: NavTrayItem | undefined; label: string; ghost?: boolean }) {
  return (
    <>
      {current ? (
        <ItemBody icon={current.icon} label={current.label} active ghost={ghost} />
      ) : (
        <ItemBody icon={MoreHorizontal} label={label} active={false} ghost={ghost} />
      )}
      <ChevronDown className="size-4 flex-none opacity-80" strokeWidth={1.5} aria-hidden />
    </>
  )
}

/**
 * Khay kính mục của thanh điều hướng theo mẫu "priority+": hiện những mục vừa chỗ theo thứ tự của vai trò, mục còn lại dồn vào nút
 * "Thêm" cuối khay mở menu — không bao giờ cuộn ngang. Bề rộng thật của từng mục (theo ngôn ngữ và mốc màn hình đang có) đọc từ bản
 * đo ẩn cạnh khay; đo trước khi vẽ (`useLayoutEffect`) và đo lại khi khung hay bản đo đổi cỡ (`ResizeObserver`). Mục đang mở nằm
 * trong "Thêm" thì nút mang tên và icon của mục đó, chỉ báo kính nghỉ ở nút.
 */
export function NavTray({ items }: { items: readonly NavTrayItem[] }) {
  const t = useT()
  const { pathname } = useLocation()
  const { navRef, followRef } = useGlassFollow<HTMLElement>(GLASS_ACTIVE)
  const slotRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  const [count, setCount] = useState(items.length)

  const activeIndex = items.findIndex((item) => matchPath({ path: item.to, end: endOf(item.to) }, pathname) !== null)
  const active = activeIndex >= 0 ? items[activeIndex] : undefined
  const signature = items.map((item) => item.label).join('|')

  const measure = useCallback(() => {
    const slot = slotRef.current
    const tray = navRef.current
    const row = measureRef.current
    if (!slot || !tray || !row) return
    const style = getComputedStyle(tray)
    // Viền không vẽ (`border-style: none`) không chiếm chỗ dù bề rộng tính ra khác 0
    const border = (side: 'Left' | 'Right') => (style[`border${side}Style`] === 'none' ? 0 : px(style[`border${side}Width`]))
    const chrome = px(style.paddingLeft) + px(style.paddingRight) + border('Left') + border('Right')
    const width = (element: Element | null) => element?.getBoundingClientRect().width ?? 0
    const activeMore = row.querySelector('[data-measure="more-current"]')
    setCount(
      visibleNavCount({
        available: width(slot) - chrome,
        itemWidths: [...row.querySelectorAll('[data-measure="item"]')].map(width),
        gap: px(style.columnGap),
        moreWidth: width(row.querySelector('[data-measure="more"]')),
        activeIndex,
        activeMoreWidth: activeMore ? width(activeMore) : undefined,
      }),
    )
  }, [activeIndex, navRef])

  useLayoutEffect(() => {
    measure()
    const slot = slotRef.current
    const row = measureRef.current
    if (!slot || !row) return
    const observer = new ResizeObserver(() => measure())
    observer.observe(slot)
    observer.observe(row)
    return () => observer.disconnect()
  }, [measure, signature])

  const shown = items.slice(0, count)
  const hidden = items.slice(count)
  const current = active && activeIndex >= count ? active : undefined
  const moreName = current
    ? t('nav.moreCurrent', { count: hidden.length, label: current.label })
    : t('nav.moreItems', { count: hidden.length })

  return (
    <div ref={slotRef} data-nav-slot="" className="relative flex min-w-0 flex-1">
      <nav ref={navRef} aria-label={t('nav.label')} className="glass-nav relative flex w-fit max-w-full gap-0.5 overflow-hidden rounded-lg p-1">
        <span ref={followRef} aria-hidden className="glass-follow" />
        {shown.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={endOf(to)}
            aria-label={label}
            className={({ isActive }) =>
              cn(ITEM, INTERACTIVE, isActive ? 'font-semibold text-sky-text' : 'font-medium text-sky-text-2 hover:text-sky-text')
            }
          >
            {({ isActive }) => <ItemBody icon={icon} label={label} active={isActive} />}
          </NavLink>
        ))}
        {hidden.length > 0 ? (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger
              aria-label={moreName}
              data-nav-more=""
              data-nav-current={current ? '' : undefined}
              className={cn(
                ITEM,
                INTERACTIVE,
                current ? 'font-semibold text-sky-text' : 'font-medium text-sky-text-2 hover:text-sky-text data-[state=open]:text-sky-text',
              )}
            >
              <MoreBody current={current} label={t('nav.more')} />
            </DropdownMenuTrigger>
            <DropdownMenuContent side="bottom" align="start">
              {hidden.map(({ to, label, icon: Icon }) => {
                const isActive = to === active?.to
                return (
                  <DropdownMenuItem
                    key={to}
                    asChild
                    className={cn(isActive && 'bg-cyan-50 font-semibold data-[highlighted]:bg-cyan-50')}
                  >
                    <Link to={to} aria-current={isActive ? 'page' : undefined}>
                      <Icon className={cn(isActive && 'text-primary!')} strokeWidth={isActive ? 2 : 1.5} aria-hidden />
                      {label}
                      {isActive ? <Check className="ml-auto text-primary!" strokeWidth={2} aria-hidden /> : null}
                    </Link>
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </nav>

      {/* Bản đo: đủ mục và hai dạng nút "Thêm", cùng khung với phần tử thật; khung 0 × 0 nên không chiếm chỗ, không kéo trang
          dài ra; ẩn với trình đọc màn hình, không nhận focus (chỉ là `span`), không có chữ trong DOM (`ghost`) */}
      <div aria-hidden className="pointer-events-none invisible absolute top-0 left-0 size-0 overflow-hidden">
        <div ref={measureRef} className="flex w-max">
          {items.map(({ to, label, icon }, index) => (
            <span key={to} data-measure="item" className={cn(ITEM, index === activeIndex ? 'font-semibold' : 'font-medium')}>
              <ItemBody icon={icon} label={label} active={index === activeIndex} ghost />
            </span>
          ))}
          <span data-measure="more" className={cn(ITEM, 'font-medium')}>
            <MoreBody current={undefined} label={t('nav.more')} ghost />
          </span>
          {active ? (
            <span data-measure="more-current" className={cn(ITEM, 'font-semibold')}>
              <MoreBody current={active} label={t('nav.more')} ghost />
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}
