import { cn } from '@/lib/utils'
import { LogoMark, type LogoTone } from './LogoMark'

/** Khẩu hiệu thương hiệu: giữ tiếng Anh ở mọi ngôn ngữ như tên riêng (LM-105), không qua từ điển. */
export const BRAND_TAGLINE = 'Plan smarter. Load further.'

const SIZES = {
  sm: { mark: 'size-7', word: 'text-[18px]', tagline: 'text-micro', gap: 'gap-2.5' },
  md: { mark: 'size-10', word: 'text-[26px]', tagline: 'text-caption', gap: 'gap-3' },
  lg: { mark: 'size-14', word: 'text-[36px]', tagline: 'text-body', gap: 'gap-4' },
} as const

/** "Load" theo màu chữ n, "Master" theo màu chữ L — như bản logo gốc. Trên nền tối "Master" dùng `--logo-sky` để đủ tương phản. */
const WORD: Readonly<Record<LogoTone, { load: string; master: string; tagline: string }>> = {
  color: { load: 'text-(--logo-navy)', master: 'text-(--logo-blue)', tagline: 'text-ink-2' },
  dark: { load: 'text-(--logo-on-dark)', master: 'text-(--logo-sky)', tagline: 'text-sky-text-3' },
  mono: { load: '', master: '', tagline: '' },
}

/**
 * Bộ ghép logo LoadMaster (LM-105): biểu tượng khối + chữ "LoadMaster" (Archivo 700, chữ thật — nét sạch ở mọi cỡ) + khẩu hiệu tuỳ
 * chọn. `lockup="horizontal"` biểu tượng bên trái, `"stacked"` biểu tượng trên. Tên truy cập "LoadMaster" (`role="img"`); đặt trong
 * một liên kết đã có `aria-label` thì truyền `decorative`.
 *
 * Khẩu hiệu viết thường như câu, không viết hoa giãn chữ như bản thiết kế gốc (AGENTS mục 5 cấm viết hoa toàn bộ, giãn chữ trang trí).
 */
export function Logo({
  tone = 'color',
  size = 'md',
  lockup = 'horizontal',
  tagline = false,
  decorative = false,
  className,
}: {
  tone?: LogoTone
  size?: keyof typeof SIZES
  lockup?: 'horizontal' | 'stacked'
  tagline?: boolean
  decorative?: boolean
  className?: string
}) {
  const look = SIZES[size]
  const word = WORD[tone]
  return (
    <span
      {...(decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': 'LoadMaster' })}
      className={cn('inline-flex items-center', look.gap, lockup === 'stacked' && 'flex-col', className)}
    >
      <LogoMark tone={tone} className={look.mark} />
      <span aria-hidden className={cn('flex flex-col gap-1', lockup === 'stacked' ? 'items-center' : 'items-start')}>
        <span className={cn('font-display leading-none font-bold tracking-[-0.2px] whitespace-nowrap font-stretch-106%', look.word)}>
          <span className={word.load}>Load</span>
          <span className={word.master}>Master</span>
        </span>
        {tagline ? <span className={cn('leading-none font-medium whitespace-nowrap', look.tagline, word.tagline)}>{BRAND_TAGLINE}</span> : null}
      </span>
    </span>
  )
}
