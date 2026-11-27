import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Truck, X } from 'lucide-react'
import { memo, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Button } from '@/components/ui/Button'
import { VehicleName } from '@/components/VehicleName'
import type { VehicleConfig } from '@/domain/models'
import { useFormat, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { VehicleBodyStyle } from '@/types/vehicle-body-style'
import { DARK_SCOPE, MUTED } from '../panels/scene-ui'
import { vehicleFacts } from './vehicle-facts'
import { VehicleFactsList } from './VehicleFactsList'

const PANEL_WIDTH = 352
const EDGE_GAP = 12

/** Bảng nổi phía trên thẻ, mép phải trùng mép phải thẻ, không tràn khỏi khung nhìn; cao tối đa tới mép trên khung nhìn. */
function panelPosition(trigger: HTMLElement): CSSProperties {
  const rect = trigger.getBoundingClientRect()
  const right = Math.max(EDGE_GAP, Math.min(window.innerWidth - rect.right, window.innerWidth - PANEL_WIDTH - EDGE_GAP))
  return { bottom: window.innerHeight - rect.top + 8, right, maxHeight: Math.max(160, rect.top - 8 - EDGE_GAP) }
}

/**
 * Thẻ xe ở hàng góc dưới phải khung 3D của Planner (giữa "Chạy lại giữ ghim" và "Chi tiết / Hiển thị"): xe mà phương án đang xem xếp
 * hàng vào, cho mọi người xem được Planner. Từ 1.280 px là icon + tên xe + dòng "dài × rộng × cao · tải trọng"; 768 → 1.279 px chỉ icon
 * (tên ở `aria-label`); dưới 768 px không có thẻ — mục "Xe của chuyến" nằm trong hộp Hiển thị. Bấm thẻ mở bảng thông số xe: Dialog Radix
 * không modal neo phía trên thẻ, nền tối đặc (bề mặt đọc, không kính); Esc / bấm ra ngoài đóng, con trỏ về thẻ. Chân bảng có nút phụ
 * "Đổi xe" chỉ khi `onChangeVehicle` có (chuyến Đã lập kế hoạch, người xem có `trips.edit`): bấm thì bảng đóng, con trỏ về thẻ rồi
 * hộp Đổi xe mở — đóng hộp đó con trỏ lại về thẻ. `bodyStyle`: kiểu thân của loại đang gắn với xe — bảng có dòng "Kiểu thân xe" chỉ
 * khi có.
 */
export const VehicleCard = memo(function VehicleCard({ vehicle, bodyStyle, onChangeVehicle }: {
  vehicle: VehicleConfig
  bodyStyle?: VehicleBodyStyle
  onChangeVehicle?: () => void
}) {
  const t = useT()
  const format = useFormat()
  const facts = useMemo(() => vehicleFacts(vehicle, bodyStyle), [vehicle, bodyStyle])
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<CSSProperties>({})
  const triggerRef = useRef<HTMLButtonElement>(null)
  const changeAfterClose = useRef(false)

  useEffect(() => {
    if (!open) return
    function reposition() {
      if (triggerRef.current) setPosition(panelPosition(triggerRef.current))
    }
    window.addEventListener('resize', reposition)
    return () => window.removeEventListener('resize', reposition)
  }, [open])

  function handleOpenChange(next: boolean) {
    if (next && triggerRef.current) setPosition(panelPosition(triggerRef.current))
    setOpen(next)
  }

  const summary = `${format.dimensions(facts.interior.lengthCm, facts.interior.widthCm, facts.interior.heightCm)} · ${format.weight(facts.payloadKg)}`
  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange} modal={false}>
      <DialogPrimitive.Trigger asChild>
        <Button ref={triggerRef} variant="glass" data-vehicle-card title={facts.name} aria-label={t('viewer.vehicleCard.label', { name: facts.name })}
          className="pointer-events-auto hidden size-14 shrink-0 p-0 glass-dark md:flex xl:h-10 xl:w-auto xl:max-w-64 xl:justify-start xl:gap-2.5 xl:px-3">
          <Truck strokeWidth={1.5} />
          <span className="hidden min-w-0 flex-col items-start text-left xl:flex">
            <VehicleName name={facts.name} className="block w-full truncate text-small leading-4 font-semibold" />
            <span className={cn('block w-full truncate font-mono text-micro tabular-nums', MUTED)}>{summary}</span>
          </span>
        </Button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content data-vehicle-panel style={{ ...position, width: PANEL_WIDTH }}
          onCloseAutoFocus={(event) => {
            // Mở hộp Đổi xe: con trỏ đã về thẻ trước khi hộp đó mount (nó nhớ thẻ là nơi trả con trỏ); không kéo con trỏ ra khỏi hộp đó
            if (!changeAfterClose.current) return
            changeAfterClose.current = false
            event.preventDefault()
          }}
          className={cn('fixed z-300 flex max-w-[calc(100vw-24px)] flex-col gap-3 overflow-y-auto rounded-xl border border-border-dark bg-panel-dark p-4 shadow-e3 outline-none',
            'data-[state=open]:animate-[lm-fade-in_150ms_var(--ease-standard)]', DARK_SCOPE)}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <DialogPrimitive.Title className="font-display text-body-lg font-[650] text-sky-text xl:text-lede">{t('viewer.vehicleCard.title')}</DialogPrimitive.Title>
              <p className="text-body-lg font-semibold text-glass-dark-text xl:text-body"><VehicleName name={facts.name} /></p>
              <DialogPrimitive.Description className="sr-only">{t('viewer.vehicleCard.description')}</DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close asChild>
              <Button variant="glass" className="size-14 flex-none p-0 xl:size-8" aria-label={t('viewer.vehicleCard.close')}><X strokeWidth={1.5} /></Button>
            </DialogPrimitive.Close>
          </div>
          <VehicleFactsList facts={facts} />
          {onChangeVehicle ? (
            <div className="flex justify-end border-t border-border-dark pt-3">
              <Button variant="glass" className="h-14 text-body-lg xl:h-9 xl:text-body"
                onClick={() => {
                  changeAfterClose.current = true
                  triggerRef.current?.focus()
                  setOpen(false)
                  onChangeVehicle()
                }}>
                <Truck strokeWidth={1.5} />{t('viewer.plan.changeVehicle')}
              </Button>
            </div>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
})
