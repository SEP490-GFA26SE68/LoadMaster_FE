import { Button } from '@/components/ui/Button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/Dialog'
import type { ScenePlacement } from '@/features/viewer3d/scene-input'
import { useT } from '@/lib/i18n'

/**
 * Hộp xác nhận "Báo thiếu" ở bước soạn hàng (FE-6-02, D-82): báo thiếu là ghi thật vào kho — điều phối viên được báo và sẽ quyết tìm
 * tiếp hay bỏ kiện khỏi chuyến — nên hỏi lại trước. Nút 56px, chữ 16px cho tablet (mục 10).
 */
export function MissingPackageDialog({ placement, onOpenChange, onConfirm, pending }: {
  /** Kiện đang hỏi; `null` là hộp đóng. */
  placement: Pick<ScenePlacement, 'id' | 'name' | 'stop'> | null
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
            <DialogTitle className="text-h2 font-semibold">{t('warehouse.missingDialog.title', { id: placement.id })}</DialogTitle>
            <DialogDescription className="text-body-lg text-pretty text-text-2">
              {t('warehouse.missingDialog.description', { id: placement.id })}
            </DialogDescription>
            <p className="m-0 text-body-lg">{placement.name} · {t('common.stop', { number: placement.stop })}</p>
          </div>
          <DialogFooter className="justify-end px-6">
            <DialogClose asChild>
              <Button type="button" variant="secondary" size="touch">{t('warehouse.missingDialog.cancel')}</Button>
            </DialogClose>
            <Button type="button" variant="primary" size="touch" loading={pending} onClick={() => onConfirm(placement.id)}>
              {t('warehouse.missingDialog.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
  )
}
