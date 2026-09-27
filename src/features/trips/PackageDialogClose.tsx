import { X } from 'lucide-react'
import { DialogClose } from '@/components/ui/Dialog'
import { useT } from '@/lib/i18n'

/** Nút × ở góc đầu hộp thoại V2.3 (`.dlg-x`): 32 px, icon 18 px `--ink-3`, đặt làm con của `DialogHeader`. */
export function PackageDialogClose() {
  const t = useT()
  return (
    <DialogClose
      aria-label={t('trips.form.closeDialog')}
      className="-mt-1 -mr-2 grid size-8 flex-none place-items-center rounded-md text-ink-3 transition-colors duration-(--dur-fast) ease-standard hover:bg-surface hover:text-ink-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <X className="size-4.5" strokeWidth={1.75} aria-hidden />
    </DialogClose>
  )
}
