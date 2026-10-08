import * as DialogPrimitive from '@radix-ui/react-dialog'
import { CalendarDays, ChevronDown, X } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Button } from '@/components/ui/Button'
import { fieldBoxClass, focusClass } from '@/components/ui/field-styles'
import { Input } from '@/components/ui/Input'
import { useFormat, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const PANEL_WIDTH = 320
const EDGE_GAP = 16

/** Chữ giá trị trên nút: "Mọi ngày", "Từ …", "Đến …", một ngày, hoặc "… – …". Ngày `YYYY-MM-DD` là nửa đêm giờ máy để in đúng ngày. */
function useRangeText(from: string, to: string) {
  const t = useT()
  const format = useFormat()
  const day = (value: string) => format.date(new Date(`${value}T00:00:00`))
  const start = ISO_DATE.test(from) ? day(from) : ''
  const end = ISO_DATE.test(to) ? day(to) : ''
  if (start && end) return start === end ? start : t('audit.log.dateRangeValue.between', { from: start, to: end })
  if (start) return t('audit.log.dateRangeValue.from', { date: start })
  if (end) return t('audit.log.dateRangeValue.to', { date: end })
  return t('audit.log.dateRangeValue.any')
}

/** Vị trí của bảng nổi: dưới nút, căn mép trái nút nhưng không tràn mép phải khung nhìn. */
function panelPosition(trigger: HTMLElement): CSSProperties {
  const rect = trigger.getBoundingClientRect()
  return { top: rect.bottom + 8, left: Math.max(EDGE_GAP, Math.min(rect.left, window.innerWidth - PANEL_WIDTH - EDGE_GAP)) }
}

/**
 * Bộ lọc khoảng ngày của Nhật ký (V2.3): một nút hiện khoảng đang chọn ("Khoảng ngày · 23/09/2026 – 24/09/2026" hoặc "Mọi ngày"), bấm
 * mở bảng nhỏ có hai ô ngày và "Xoá lọc". Thay hai ô `type="date"` đứng thẳng hàng của `FilterBar`; giá trị vẫn là hai tham số URL
 * (`tu`, `den`) và việc lọc do màn làm.
 *
 * Bảng nổi là Dialog Radix **không modal** (`modal={false}`): Esc và bấm ra ngoài thì đóng, con trỏ về nút, không khoá phần còn lại
 * của trang. Nó nằm trong portal nên không bị thẻ bảng `overflow-hidden` cắt; vị trí tính từ nút lúc mở và tính lại khi cuộn hoặc
 * đổi cỡ cửa sổ. Ô ngày giữ bản nháp tại chỗ: router đổi URL trong `startTransition`, ô nối thẳng vào URL sẽ nhảy về giá trị cũ.
 */
export function AuditDateRange({ from, to, onFromChange, onToChange }: {
  from: string
  to: string
  onFromChange: (value: string) => void
  onToChange: (value: string) => void
}) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<CSSProperties>({})
  const triggerRef = useRef<HTMLButtonElement>(null)
  const text = useRangeText(from, to)
  const active = from !== '' || to !== ''

  useEffect(() => {
    if (!open) return
    function reposition() {
      if (triggerRef.current) setPosition(panelPosition(triggerRef.current))
    }
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    return () => {
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
    }
  }, [open])

  function handleOpenChange(next: boolean) {
    if (next && triggerRef.current) setPosition(panelPosition(triggerRef.current))
    setOpen(next)
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange} modal={false}>
      <DialogPrimitive.Trigger asChild>
        <button
          ref={triggerRef}
          type="button"
          className={cn(
            'flex h-10 flex-none cursor-pointer items-center gap-2 px-3',
            fieldBoxClass(false),
            focusClass,
            'focus-visible:outline-none',
            active && 'border-cyan-300 bg-cyan-50 text-cyan-800',
          )}
        >
          <CalendarDays aria-hidden className="size-4 flex-none" strokeWidth={1.5} />
          <span className="text-caption font-medium text-ink-2">{t('audit.log.dateRange')}</span>
          <span aria-hidden className="text-ink-3">·</span>
          <span className="whitespace-nowrap font-semibold">{text}</span>
          <ChevronDown aria-hidden className="size-4 flex-none text-ink-3" strokeWidth={1.5} />
        </button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content
          style={{ ...position, width: PANEL_WIDTH }}
          className="fixed z-300 flex max-w-[calc(100vw-32px)] flex-col gap-4 rounded-xl bg-bg p-4 shadow-e2 outline-none"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <DialogPrimitive.Title className="font-display text-h3 font-bold text-ink-strong">{t('audit.log.dateRange')}</DialogPrimitive.Title>
              <DialogPrimitive.Description className="text-small text-ink-2">{text}</DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close
              aria-label={t('audit.log.dateRangeClose')}
              className="grid size-8 flex-none cursor-pointer place-items-center rounded-md text-ink-3 hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <X className="size-4" strokeWidth={1.5} aria-hidden />
            </DialogPrimitive.Close>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <DateField label={t('common.filters.from')} value={from} max={to || undefined} onChange={onFromChange} />
            <DateField label={t('common.filters.to')} value={to} min={from || undefined} onChange={onToChange} />
          </div>
          <div className="flex justify-end">
            <Button
              variant="secondary"
              size="sm"
              disabled={!active}
              onClick={() => {
                onFromChange('')
                onToChange('')
              }}
            >
              <X strokeWidth={1.5} aria-hidden />
              {t('common.filters.clear')}
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

/** Ô ngày với bản nháp tại chỗ; giá trị ngoài đổi (xoá lọc, quay lại trang) thì ô theo. */
function DateField({ label, value, min, max, onChange }: {
  label: string
  value: string
  min?: string
  max?: string
  onChange: (value: string) => void
}) {
  const [draft, setDraft] = useState(value)
  const [source, setSource] = useState(value)
  if (value !== source) {
    setSource(value)
    setDraft(value)
  }
  return (
    <Input
      type="date"
      label={label}
      value={draft}
      min={min}
      max={max}
      onChange={(event) => {
        setDraft(event.target.value)
        onChange(event.target.value)
      }}
    />
  )
}
