import { PackageX } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import type { ScenePlacement } from '@/features/viewer3d/scene-input'
import { useT } from '@/lib/i18n'
import { StopChip } from './StopChip'

/**
 * Hộp xác nhận "Kiện hỏng" ở bước xếp (FE-6-05, D-92): ghi hỏng là ghi thật — kiện về kho kiện kèm cờ "Hư hỏng", không lên xe — nên
 * hỏi lại trước và nói trước hệ quả. `resting` là số kiện tựa lên nó **trong phương án**: bằng 0 thì kho bỏ kiện và xếp tiếp; lớn hơn 0
 * thì chuyến quay về Đã lập kế hoạch, phải dỡ ra và xếp lại theo phương án mới. Đầu hộp có ô icon hổ phách (V2.3 đợt 6). Nút 56 px,
 * chữ 16 px cho tablet (mục 10).
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
          <DialogHeader
            icon={PackageX}
            tone="warning"
            title={t('warehouse.damaged.title', { id: placement.id })}
            description={resting > 0 ? t('warehouse.damaged.withSupport', { count: resting }) : t('warehouse.damaged.noSupport')}
            className="[&_p]:text-body-lg"
          />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-7 pt-4 pb-6">
            <span className="font-mono text-body-lg font-semibold text-ink-strong">{placement.id}</span>
            <span className="text-body-lg text-ink-2">{placement.name}</span>
            <StopChip stop={placement.stop} label={t('common.stop', { number: placement.stop })} />
          </div>
          <DialogFooter>
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
