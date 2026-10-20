import { Globe } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { LOCALE_NAMES, LOCALES, useLocale, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'

type LanguageMenuProps = {
  /** Đổi cỡ nút (mặc định 36 px vuông — thanh điều hướng của ứng dụng); đầu trang công khai: 40 px, 56 px trên máy cảm ứng. */
  className?: string
  /** Cỡ mục của menu (đầu trang công khai trên máy cảm ứng: 56 px). */
  itemClassName?: string
  /** `glass` (mặc định): kính sáng trên dải trời hoặc nền tối. `solid`: nền đặc `--sky-solid` — màn đăng nhập, nơi không dùng kính. */
  tone?: 'glass' | 'solid'
}

/**
 * Ngôn ngữ giao diện trên nền tối: nút vuông chỉ có biểu tượng quả địa cầu, mở menu nền trắng đặc chọn Tiếng Việt / English. Đổi ngôn
 * ngữ tại chỗ như `LanguageSwitch` — không tải lại trang, dữ liệu đang nhập giữ nguyên.
 *
 * Nút không có chữ: tên truy cập là "Ngôn ngữ giao diện" (`language.label`), gợi ý khi rê chuột nói ngôn ngữ đang dùng. Mỗi mục đọc là
 * mã + tên ngôn ngữ viết bằng chính ngôn ngữ đó ("EN English"), để người không đọc được ngôn ngữ đang hiện vẫn tìm ra. Màn toàn màn
 * hình (kho, tài xế) vẫn dùng `LanguageSwitch` — hai nút 56 px bấm một lần, hợp găng tay hơn menu.
 */
export function LanguageMenu({ className, itemClassName, tone = 'glass' }: LanguageMenuProps = {}) {
  const t = useT()
  const { locale, setLocale } = useLocale()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t('language.label')}
        title={t('language.current', { name: LOCALE_NAMES[locale] })}
        className={cn(
          'grid size-9 flex-none place-items-center rounded-md border text-sky-text outline-none',
          'transition-colors duration-(--dur-fast) ease-standard',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 data-[state=open]:border-cyan-300',
          tone === 'solid'
            ? 'border-sky-solid-border bg-sky-solid hover:bg-sky-solid-hover'
            : 'border-sky-glass-border bg-sky-glass hover:bg-sky-glass-hover',
          className,
        )}
      >
        <Globe aria-hidden className="size-5" strokeWidth={1.5} />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="end" className="min-w-58">
        <DropdownMenuLabel className="text-fine text-ink-3">{t('language.label')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={locale} onValueChange={(value) => { const next = LOCALES.find((option) => option === value); if (next) setLocale(next) }}>
          {LOCALES.map((option) => (
            <DropdownMenuRadioItem key={option} value={option} lang={option} className={itemClassName}>
              <span className="rounded-sm border border-border px-1.5 py-0.5 text-micro font-semibold text-ink-2">{option.toUpperCase()}</span>{' '}
              {LOCALE_NAMES[option]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
