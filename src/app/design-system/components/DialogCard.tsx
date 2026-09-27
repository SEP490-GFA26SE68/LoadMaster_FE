import { Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { DialogFooter } from '@/components/ui/Dialog'
import { useT } from '@/lib/i18n'
import type { SheetSample } from '../design-system-api'
import { Preview, SheetCard } from '../SheetLayout'

/**
 * Hộp thoại xác nhận xoá kiện của form kiện, trên lớp phủ `--scrim` (tối 50%, không làm mờ). `DialogHeader` cần ngữ cảnh Radix nên
 * đầu hộp thoại vẽ lại bằng cùng lớp; chân dùng thẳng `DialogFooter`. Bản xem trước `inert` — hộp thoại thật chỉ mở từ màn.
 */
export function DialogCard({ sample }: { sample: SheetSample | undefined }) {
  const t = useT()
  const title = t('designSystem.components.dialog.title')
  return (
    <SheetCard title={title} meta={t('designSystem.components.dialog.meta')} bare>
      <Preview label={title} className="grid place-items-center rounded-b-lg bg-scrim p-6.5">
        <div className="flex w-110 max-w-full flex-col overflow-hidden rounded-xl bg-bg shadow-e3">
          <div className="flex items-start gap-3.5 px-7 pt-6 pb-4.5">
            <span className="grid size-10 flex-none place-items-center rounded-lg bg-red-50 text-red-700">
              <Trash2 className="size-5" strokeWidth={1.5} aria-hidden />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="font-display text-h2 leading-6.5 font-bold text-ink-strong font-stretch-106%">
                {t('trips.form.deleteTitle', { id: sample?.pkg.id ?? '' })}
              </span>
              <span className="text-body leading-5.25 text-ink-2">{t('trips.form.deleteDescription')}</span>
            </div>
            <X className="size-4 flex-none text-n-600" strokeWidth={1.75} aria-hidden />
          </div>
          <DialogFooter>
            <Button variant="secondary">{t('trips.form.cancel')}</Button>
            <Button variant="danger">{t('trips.form.delete')}</Button>
          </DialogFooter>
        </div>
      </Preview>
    </SheetCard>
  )
}
