import { X } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { TOAST_CLASSES, TOAST_ICONS } from '../../toast-look'
import { Preview, SheetCard } from '../SheetLayout'

type Kind = 'success' | 'warning' | 'error'

/**
 * Ba tông toast vẽ bằng đúng lớp của `Toaster` (`app/toast-look.tsx`), đặt tĩnh trong thẻ thay vì bay ở góc màn. Câu là câu thật
 * của Planner và form chuyến. Bản xem trước `inert`: nút đóng chỉ là hình.
 */
export function ToastCard() {
  const t = useT()
  const title = t('designSystem.components.toast.title')
  const toasts: readonly { kind: Kind; title: string; description?: string }[] = [
    { kind: 'success', title: t('viewer.plan.dialog.done') },
    { kind: 'warning', title: t('viewer.plan.blockedStale'), description: t('viewer.plan.dialog.stale') },
    { kind: 'error', title: t('trips.create.failed'), description: t('manager.errorDescription') },
  ]
  return (
    <SheetCard title={title} meta={t('designSystem.components.toast.meta')}>
      <Preview label={title} className="flex flex-col gap-3">
        {toasts.map((toast) => (
          <div key={toast.kind} className={TOAST_CLASSES.toast}>
            <span className={TOAST_CLASSES.icon}>{TOAST_ICONS[toast.kind]}</span>
            <div className={TOAST_CLASSES.content}>
              <span className={TOAST_CLASSES.title}>{toast.title}</span>
              {toast.description ? <span className={TOAST_CLASSES.description}>{toast.description}</span> : null}
            </div>
            <span className="grid size-7 flex-none place-items-center rounded-sm text-n-600">
              <X className="size-4" strokeWidth={1.75} aria-hidden />
            </span>
          </div>
        ))}
      </Preview>
    </SheetCard>
  )
}
