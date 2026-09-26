import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { LOCALE_NAMES, LOCALES, useLocale, useT } from '@/lib/i18n'

/**
 * Ngôn ngữ giao diện trên dải trời (V2.3 `MenuToanCuc.jpg`): nút kính 36px ghi mã ngôn ngữ đang dùng, mở menu nền trắng đặc chọn
 * Tiếng Việt / English. Đổi ngôn ngữ tại chỗ như `LanguageSwitch` — không tải lại trang, dữ liệu đang nhập giữ nguyên.
 *
 * Mỗi mục đọc là mã + tên ngôn ngữ viết bằng chính ngôn ngữ đó ("EN English"), để người không đọc được ngôn ngữ đang hiện vẫn tìm ra.
 * Màn toàn màn hình (kho, tài xế) vẫn dùng `LanguageSwitch` — hai nút 56px bấm một lần, hợp găng tay hơn menu.
 */
export function LanguageMenu() {
  const t = useT()
  const { locale, setLocale } = useLocale()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t('language.label')}
        className="grid h-9 min-w-9 place-items-center rounded-md border border-sky-glass-border bg-sky-glass px-2.5 text-caption font-semibold text-sky-text outline-none hover:bg-sky-glass-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 data-[state=open]:border-cyan-300"
      >
        {locale.toUpperCase()}
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="end" className="min-w-58">
        <DropdownMenuLabel className="text-fine text-ink-3">{t('language.label')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={locale} onValueChange={(value) => { const next = LOCALES.find((option) => option === value); if (next) setLocale(next) }}>
          {LOCALES.map((option) => (
            <DropdownMenuRadioItem key={option} value={option} lang={option}>
              <span className="rounded-sm border border-border px-1.5 py-0.5 text-micro font-semibold text-ink-2">{option.toUpperCase()}</span>{' '}
              {LOCALE_NAMES[option]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
