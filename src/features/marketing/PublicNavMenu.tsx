import { Menu } from 'lucide-react'
import { useRef } from 'react'
import { Link, useLocation } from 'react-router'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/DropdownMenu'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { isCurrentLink, PUBLIC_LINKS, PUBLIC_TOUCH } from './public-chrome'

/**
 * Mục của trang dưới 1.024 px: nút menu kính trên dải trời (40 px, 56 px trên máy cảm ứng) mở bốn liên kết, mỗi mục 56 px trên máy cảm
 * ứng. Chọn một mục thì menu không trả focus về nút: trang đã cuộn tới phần đó và đặt focus vào tiêu đề của phần (`useHashScroll`).
 */
export function PublicNavMenu({ className }: { className?: string }) {
  const t = useT()
  const { pathname } = useLocation()
  const navigated = useRef(false)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t('landingChrome.menu')}
        className={cn(
          'grid size-10 flex-none place-items-center rounded-md border border-sky-glass-border bg-sky-glass text-sky-text outline-none',
          'hover:bg-sky-glass-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300',
          'data-[state=open]:border-cyan-300 pointer-coarse:size-14',
          className,
        )}
      >
        <Menu aria-hidden className="size-5" strokeWidth={1.5} />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-56"
        onCloseAutoFocus={(event) => {
          if (navigated.current) event.preventDefault()
          navigated.current = false
        }}
      >
        {PUBLIC_LINKS.map((link) => (
          <DropdownMenuItem key={link.labelKey} asChild className={PUBLIC_TOUCH} onSelect={() => { navigated.current = true }}>
            <Link to={link.to} aria-current={isCurrentLink(link, pathname) ? 'page' : undefined}>
              {t(link.labelKey)}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
