import { DoorOpen, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { useT } from '@/lib/i18n'

/**
 * "Rời trang khi chưa lưu?" của form chuyến (LM-100, V2.3 HopThoaiChuyen.jpg): ô icon cửa đỏ, nút đóng góc phải, "Ở lại" phụ và
 * "Rời trang" đỏ. `ConfirmDialog` dùng chung chỉ có icon cảnh báo và không có nút đóng, nên hộp thoại này dựng từ `Dialog`.
 */
export function TripFormLeaveDialog({ open, onStay, onLeave }: { open: boolean; onStay: () => void; onLeave: () => void }) {
  const t = useT()
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onStay() }}>
      <DialogContent className="w-120">
        <DialogHeader icon={DoorOpen} tone="danger" title={t('trips.leave.title')} description={t('trips.leave.description')} className="pb-5">
          <DialogClose asChild>
            <Button type="button" variant="ghost" size="sm" className="-mt-1 -mr-2 size-8 px-0 text-ink-3" aria-label={t('trips.leave.close')}>
              <X strokeWidth={1.75} />
            </Button>
          </DialogClose>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onStay}>{t('trips.leave.stay')}</Button>
          <Button type="button" variant="danger" onClick={onLeave}>{t('trips.leave.confirm')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
