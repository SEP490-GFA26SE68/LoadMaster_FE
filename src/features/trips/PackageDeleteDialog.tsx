import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { useT } from '@/lib/i18n'
import { PackageDialogClose } from './PackageDialogClose'

/**
 * Xác nhận xoá kiện (V2.3 `HopThoaiChuyen` "Xoá kiện"): ô icon thùng rác đỏ, tiêu đề có mã kiện, nói phương án đã tối ưu thành lỗi
 * thời; "Huỷ" phụ, "Xoá kiện" nút nguy hiểm — một nút đậm duy nhất.
 */
export function PackageDeleteDialog({ open, onOpenChange, packageId, onConfirm }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  packageId: string
  onConfirm: () => void
}) {
  const t = useT()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-120">
        <DialogHeader
          icon={Trash2}
          tone="danger"
          title={t('trips.form.deleteTitle', { id: packageId })}
          description={t('trips.form.deleteDescription')}
          className="pb-5"
        >
          <PackageDialogClose />
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>{t('trips.form.cancel')}</Button>
          <Button type="button" variant="danger" onClick={onConfirm}>{t('trips.form.delete')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
