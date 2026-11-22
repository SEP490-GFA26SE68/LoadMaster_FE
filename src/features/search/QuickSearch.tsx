import { Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { NavRailButton } from '@/components/NavRailButton'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/Dialog'
import { useCan } from '@/features/auth/useCan'
import { useT } from '@/lib/i18n'
import { QuickSearchPanel } from './QuickSearchPanel'
import { quickSearchGroups } from './search-groups'
import { SHORTCUT_KEYS } from './shortcut'

/** Ctrl+K (Windows, Linux) hoặc ⌘K (Mac), không kèm phím bổ trợ khác. */
function isShortcut(event: KeyboardEvent): boolean {
  return (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'k'
}

/**
 * Bề rộng từ đó nút thành ô kính 176px "Tìm nhanh · Ctrl K" (V2.3 `.glass-search.compact`); hẹp hơn thì chỉ còn icon 36px. Lớp viết đủ chữ
 * để Tailwind sinh được.
 */
const WIDE = {
  1536: { button: 'w-9 px-0 min-[1536px]:w-44 min-[1536px]:justify-start min-[1536px]:px-3', text: 'hidden min-[1536px]:contents' },
  1680: { button: 'w-9 px-0 min-[1680px]:w-44 min-[1680px]:justify-start min-[1680px]:px-3', text: 'hidden min-[1680px]:contents' },
} as const

/**
 * Tìm nhanh (LM-099, D-55): nút "Tìm nhanh" trên nav rail và phím Ctrl+K / ⌘K ở mọi màn có nav rail mở hộp thoại tìm chuyến, kiện,
 * xe, người dùng, yêu cầu giao, kho kiện, loại kiện — chỉ nhóm người đăng nhập được xem và đọc được từ nguồn đang dùng
 * (`quickSearchGroups`). Không nhóm nào (kho, tài xế, quản lý nền tảng, hỗ trợ khách hàng) thì không có nút và không bắt phím: không mở
 * hộp thoại luôn rỗng (FE-0-04). Mở bằng phím tắt thì đóng xong con trỏ về chỗ cũ; mở bằng nút thì về nút. `wideFrom` dời mốc ô rộng khi
 * thanh có thêm nút (trợ lý AI): ô rộng thêm 140px, tám mục của quản lý công ty không còn chỗ ở 1.536 px.
 */
export function QuickSearch({ wideFrom = 1536 }: { wideFrom?: keyof typeof WIDE }) {
  const t = useT()
  const can = useCan()
  const navigate = useNavigate()
  const groups = useMemo(() => quickSearchGroups(can), [can])
  const [open, setOpen] = useState(false)
  const returnFocus = useRef<HTMLElement | null>(null)
  const enabled = groups.length > 0

  useEffect(() => {
    if (!enabled) return undefined
    function handleKeyDown(event: KeyboardEvent) {
      if (!isShortcut(event)) return
      event.preventDefault()
      const focused = document.activeElement
      // Đang ở trong một hộp thoại khác (hoặc chính hộp tìm nhanh): không chồng hộp thoại
      if (focused?.closest('[role="dialog"], [role="alertdialog"]')) return
      returnFocus.current = focused instanceof HTMLElement && focused !== document.body ? focused : null
      setOpen(true)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enabled])

  if (!enabled) return null

  function handleOpenResult(href: string) {
    setOpen(false)
    void navigate(href)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <NavRailButton
          icon={Search}
          label={t('search.button')}
          aria-keyshortcuts="Control+K Meta+K"
          className={WIDE[wideFrom].button}
          text={
            <span className={WIDE[wideFrom].text}>
              <span className="text-small whitespace-nowrap">{t('search.button')}</span>
              <kbd className="ml-auto rounded-sm border border-sky-glass-border px-1.5 py-0.75 font-sans text-micro leading-none font-medium whitespace-nowrap">
                {SHORTCUT_KEYS}
              </kbd>
            </span>
          }
          onClick={() => {
            returnFocus.current = null
          }}
        />
      </DialogTrigger>
      <DialogContent
        // Kính tối (`.glass-dark`, V2.3 TimNhanh): nền, viền và bóng của lớp kính thay nền trắng của hộp thoại
        className="glass-dark mt-[12vh] self-start"
        onCloseAutoFocus={(event) => {
          const target = returnFocus.current
          returnFocus.current = null
          if (target?.isConnected) {
            event.preventDefault()
            target.focus()
          }
        }}
      >
        <DialogTitle className="sr-only">{t('search.title')}</DialogTitle>
        <DialogDescription className="sr-only">{t('search.placeholder')}</DialogDescription>
        {/* Hộp tìm nhanh của bản mẫu đặc hơn kính trên khung 3D vì nằm trên lớp phủ, đè cả bảng trắng: một lớp `--cyan-950` mờ */}
        <div className="flex min-h-0 flex-col bg-cyan-950/40">
          <QuickSearchPanel groups={groups} onOpenResult={handleOpenResult} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
