import { Button } from '@/components/ui/Button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/Dialog'
import type { ScenePlacement } from '@/features/viewer3d/scene-input'
import { useT } from '@/lib/i18n'

/**
 * Hộp xác nhận "Kiện hỏng" ở bước xếp (FE-6-05, D-92): ghi hỏng là ghi thật — kiện về kho kiện kèm cờ "Hư hỏng", không lên xe — nên
 * hỏi lại trước và nói trước hệ quả. `resting` là số kiện tựa lên nó **trong phương án**: bằng 0 thì kho bỏ kiện và xếp tiếp; lớn hơn 0
 * thì chuyến quay về Đã lập kế hoạch, phải dỡ ra và xếp lại theo phương án mới. Nút 56 px, chữ 16 px cho tablet (mục 10).
 */
export function DamagedPackageDialog({ placement, resting, onOpenChange, onConfirm, pending }: {
  /** Kiện đang hỏi; `null` là hộp đóng. */
  placement: Pick<ScenePlacement, 'id' | 'name' | 'stop'> | null
  resting: number
  onOpenChange: (open: boolean) => void
  onConfirm: (id: string) => void
  pending: boolean
}) {
  const t = useT()
  return (
    <Dialog open={placement !== null} onOpenChange={onOpenChange}>
      {placement ? (
        <DialogContent className="w-140">
          <div className="flex flex-col gap-2 px-6 pt-6 pb-2">
            <DialogTitle className="text-h2 font-semibold">{t('warehouse.damaged.title', { id: placement.id })}</DialogTitle>
            <DialogDescription className="text-body-lg text-pretty text-text-2">
              {resting > 0 ? t('warehouse.damaged.withSupport', { count: resting }) : t('warehouse.damaged.noSupport')}
            </DialogDescription>
            <p className="m-0 text-body-lg">{placement.name} · {t('common.stop', { number: placement.stop })}</p>
          </div>
          <DialogFooter className="justify-end px-6">
            <DialogClose asChild>
              <Button type="button" variant="secondary" size="touch">{t('warehouse.damaged.cancel')}</Button>
            </DialogClose>
            <Button type="button" variant="primary" size="touch" loading={pending} onClick={() => onConfirm(placement.id)}>
              {t('warehouse.damaged.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
  )
}
