import { PackageX } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import type { ScenePlacement } from '@/features/viewer3d/scene-input'
import { useT } from '@/lib/i18n'
import { StopChip } from './StopChip'

/**
 * Hộp xác nhận "Báo thiếu" ở bước soạn hàng (FE-6-02, D-82): báo thiếu là ghi thật vào kho — điều phối viên được báo và sẽ quyết tìm
 * tiếp hay bỏ kiện khỏi chuyến — nên hỏi lại trước. Đầu hộp có ô icon hổ phách (V2.3 đợt 6, `KhoGhiThieu.jpg`). Nút 56px, chữ 16px
 * cho tablet (mục 10).
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
          <DialogHeader
            icon={PackageX}
            tone="warning"
            title={t('warehouse.missingDialog.title', { id: placement.id })}
            description={t('warehouse.missingDialog.description', { id: placement.id })}
            className="[&_p]:text-body-lg"
          />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-7 pt-4 pb-6">
            <span className="font-mono text-body-lg font-semibold text-ink-strong">{placement.id}</span>
            <span className="text-body-lg text-ink-2">{placement.name}</span>
            <StopChip stop={placement.stop} label={t('common.stop', { number: placement.stop })} />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" size="touch">{t('warehouse.missingDialog.cancel')}</Button>
            </DialogClose>
            <Button type="button" variant="primary" size="touch" loading={pending} onClick={() => onConfirm(placement.id)}>
              <PackageX strokeWidth={2} />
              {t('warehouse.missingDialog.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
  )
}
