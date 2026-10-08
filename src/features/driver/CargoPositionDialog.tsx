import { lazy, Suspense, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/Dialog'
import { Spinner } from '@/components/ui/Spinner'
import type { ViewerSceneModel } from '@/features/viewer3d/scene-input'
import { useT } from '@/lib/i18n'
import type { UnplacedPickup } from './driver-pickups'

const DriverCargoViewer = lazy(() => import('@/features/viewer3d/DriverCargoViewer').then((m) => ({ default: m.DriverCargoViewer })))

/**
 * Nút "Xem vị trí hàng" và khung 3D toàn màn hình của nó (LM-061; V2.3 đợt 6): mô phỏng dỡ theo thứ tự dỡ của phương án, không đánh dấu
 * giao hàng. Thanh tiêu đề và mọi bảng điều khiển quanh khung 3D là bề mặt tối đặc (`--panel-dark`), nút đóng là nút đặc trên nền tối.
 * Three.js chỉ tải khi mở (mục 7).
 */
export function CargoPositionDialog({ model, stopNumber, doneIds, pickupCargo }: {
  model: ViewerSceneModel
  stopNumber: number
  /** Kiện không còn trên xe: đã dỡ ở mọi điểm và kiện hỏng bị bỏ lại kho. */
  doneIds: ReadonlySet<string>
  pickupCargo: readonly UnplacedPickup[]
}) {
  const t = useT()
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="secondary" size="touch">{t('driver.viewCargo')}</Button></DialogTrigger>
      {open ? (
        <DialogContent className="fixed inset-0 h-dvh max-h-dvh w-full max-w-full rounded-none bg-canvas-1">
          <div className="flex h-20 shrink-0 items-center justify-between gap-3 border-b border-border-dark bg-panel-dark px-3">
            <DialogTitle className="font-display text-h2 leading-7 font-bold text-sky-text font-stretch-106%">{t('driver.cargo.title')}</DialogTitle>
            <DialogClose asChild><Button variant="skySolid" size="touch">{t('driver.cargo.close')}</Button></DialogClose>
          </div>
          <DialogDescription className="sr-only">{t('driver.cargo.description')}</DialogDescription>
          <Suspense fallback={<div className="grid flex-1 place-items-center bg-canvas-1"><Spinner tone="light" /></div>}>
            <DriverCargoViewer model={model} stopNumber={stopNumber} doneIds={doneIds} pickupCargo={pickupCargo} />
          </Suspense>
        </DialogContent>
      ) : null}
    </Dialog>
  )
}
