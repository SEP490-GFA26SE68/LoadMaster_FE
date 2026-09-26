import { TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Kiểu chung của ô nhập V2.3 (`v3.css` `.fld`, `.ctl`, `.help`, `.msg-err`) cho Input, Textarea, Select và SelectField — một chỗ để
 * bốn điều khiển không lệch nhau.
 *
 * - Nhãn 13/600 `--ink-2`, dấu * đỏ.
 * - Ô cao 40, bo `--r-md`, viền `--line-strong` (3:1 trên trắng, WCAG 1.4.11).
 * - Focus: viền `--cyan-500` + quầng 3px; lỗi: viền `--red-500` + quầng đỏ nhạt. Quầng thay vòng outline của nút — ô nhập vẫn có
 *   dấu hiệu focus đủ rõ, không chồng hai vòng.
 * - Chỉ đọc / vô hiệu hoá: nền `--n-50`, viền `--n-200`.
 */
export const fieldLabelClass = 'text-small font-semibold text-ink-2'

export function fieldBoxClass(invalid: boolean) {
  return cn(
    'rounded-md border bg-bg text-body text-text outline-none transition-[border-color,box-shadow] duration-(--dur-fast) ease-standard',
    invalid ? 'border-red-500 shadow-error' : 'border-line-strong',
  )
}

/** Focus trên chính ô (`:focus-visible`). Ô có hậu tố đơn vị dùng `focusWithinClass` trên khung bọc. */
export const focusClass = 'focus-visible:border-cyan-500 focus-visible:shadow-focus'
export const focusWithinClass = 'focus-within:border-cyan-500 focus-within:shadow-focus'
export const disabledClass = 'disabled:border-n-200 disabled:bg-n-50 disabled:text-n-600'
/** Chỉ cho input/textarea: `:read-only` khớp cả nút (SelectTrigger) vì nút không sửa được. */
export const readOnlyClass = 'read-only:border-n-200 read-only:bg-n-50 read-only:text-ink-2'

export function FieldLabel({ htmlFor, required, children }: { htmlFor: string; required?: boolean; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className={fieldLabelClass}>
      {children}
      {required ? <span className="text-danger"> *</span> : null}
    </label>
  )
}

/** Lỗi (đỏ, có icon) thay chỗ gợi ý. `id` để ô nhập trỏ `aria-describedby` vào. */
export function FieldMessage({ id, error, hint }: { id?: string; error?: ReactNode; hint?: ReactNode }) {
  if (error) {
    return (
      <span id={id} className="flex items-start gap-1.5 text-fine text-danger">
        <TriangleAlert aria-hidden className="mt-0.75 size-3.5 flex-none" strokeWidth={1.75} />
        <span>{error}</span>
      </span>
    )
  }
  return hint ? (
    <span id={id} className="text-fine text-ink-3">
      {hint}
    </span>
  ) : null
}
