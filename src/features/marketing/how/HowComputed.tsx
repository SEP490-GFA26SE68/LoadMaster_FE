import { ChevronDown } from 'lucide-react'
import { useId, useState } from 'react'
import { SKY_FOCUS } from '@/components/sky-focus'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'

/** Một con số được giải thích: nhãn của số và câu nói công thức, đã thay số thật vào. */
export type HowEntry = { readonly key: string; readonly label: string; readonly text: string }

const TONES = {
  light: {
    button: 'text-primary hover:bg-primary-bg focus-visible:outline-primary',
    panel: 'border-line-soft',
    label: 'text-ink-strong',
    text: 'text-ink-2',
  },
  dark: {
    button: cn('text-cyan-300 hover:bg-sky-glass', SKY_FOCUS),
    panel: 'border-border-dark',
    label: 'text-sky-text',
    text: 'text-sky-text-2',
  },
} as const

/**
 * "Tính thế nào?" cạnh một nhóm số của trang công khai: nút chữ nhỏ mở (`aria-expanded`) phần giải thích ngay bên dưới — mỗi số một
 * dòng: nhãn rồi công thức bằng lời thường, tham số là số đã tính của chính lần chạy (nơi gọi dựng `entries`, `how-entries.ts`). Một nút
 * cho cả nhóm số chứ không mỗi số một nút: vùng chạm 44 px (56 px trên máy cảm ứng) cạnh từng số sẽ dài hơn chính các số. `subject` nói
 * nhóm số nào để nhiều nút trên một trang khác tên truy cập. Phần giải thích chỉ dựng khi mở. Trên nền tối dùng `tone="dark"`.
 */
export function HowComputed({ entries, subject, tone = 'light', note, className }: {
  entries: readonly HowEntry[]
  subject?: string
  tone?: keyof typeof TONES
  /** Câu nguồn dưới các công thức. */
  note?: string
  className?: string
}) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const look = TONES[tone]
  if (entries.length === 0) return null
  return (
    <div className={cn('flex min-w-0 flex-col items-start', className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={subject ? t('landingHow.toggleFor', { subject }) : undefined}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          '-mx-2 inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-small font-medium transition-colors duration-(--dur-fast) ease-standard',
          'outline-none focus-visible:outline-2 focus-visible:outline-offset-[-2px] pointer-coarse:min-h-14 pointer-coarse:text-body-lg',
          look.button,
        )}
      >
        {t('landingHow.toggle')}
        <ChevronDown aria-hidden strokeWidth={1.5} className={cn('size-4 flex-none transition-transform duration-(--dur-fast) ease-standard', open && 'rotate-180')} />
      </button>
      <div id={panelId} hidden={!open} className="w-full">
        {open ? (
          <div className={cn('mt-1 flex flex-col gap-2 border-t pt-2', look.panel)}>
            <dl className="m-0 flex flex-col gap-2">
              {entries.map((entry) => (
                <div key={entry.key} className="flex flex-col gap-0.5">
                  <dt className={cn('text-small font-semibold pointer-coarse:text-body-lg', look.label)}>{entry.label}</dt>
                  <dd className={cn('m-0 text-small text-pretty pointer-coarse:text-body-lg', look.text)}>{entry.text}</dd>
                </div>
              ))}
            </dl>
            {note ? <p className={cn('m-0 text-small text-pretty pointer-coarse:text-body-lg', look.text)}>{note}</p> : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
