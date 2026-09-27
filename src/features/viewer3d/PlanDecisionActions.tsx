import { Ellipsis, RefreshCw, Truck, XCircle } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/DropdownMenu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/Tooltip'
import type { VehicleConfig } from '@/domain/models'
import { useT } from '@/lib/i18n'
import type { DecisionDialogKind } from './plan-decision'
import { PlanDecisionDialog } from './PlanDecisionDialog'

/**
 * Thanh quyết định của quản lý công ty, đứng trước nút Duyệt ở thanh trên Planner (LM-104). "Từ chối" là nút phụ có chữ; hai quyết
 * định ít dùng hơn (Yêu cầu tối ưu lại, Đề xuất đổi xe / tách chuyến) nằm trong menu "Quyết định khác" (nút chỉ icon, tên ở tooltip
 * và tên truy cập). Hàng gộp 1.280–1.679 px không đủ chỗ cho nút "Từ chối" (đo ở `e2e/planner-compact.spec.ts`, 1.366 và 1.600 px):
 * nút đó thành mục đầu của menu; điện thoại (dưới 768 px) cũng vậy. Cảm ứng (dưới 1.280 px, điều khiển mô phỏng đã xuống thanh công cụ
 * riêng) nút cao 56 px như nút Duyệt.
 */
export function PlanDecisionActions({ revisionId, vehicles, currentVehicleId }: {
  revisionId: string
  vehicles: readonly VehicleConfig[]
  currentVehicleId: string | undefined
}) {
  const t = useT()
  const [dialog, setDialog] = useState<DecisionDialogKind | null>(null)
  const more = t('review.decide.more')

  return (
    <>
      {/* Điện thoại và hàng gộp 1.280–1.679 px không còn chỗ: "Từ chối" là mục đầu của menu; tablet và từ 1.680 px là nút riêng */}
      <Button variant="glass" className="hidden h-14 px-4 text-body-lg md:flex xl:hidden min-[105rem]:flex min-[105rem]:h-9.5 min-[105rem]:px-3 min-[105rem]:text-body" onClick={() => setDialog('reject')}>
        <XCircle strokeWidth={1.5} aria-hidden />
        {t('review.decide.reject')}
      </Button>
      {/* Menu không modal để hộp thoại mở từ mục menu nhận focus (AGENTS mục 9, LM-088) */}
      <DropdownMenu modal={false}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button variant="glass" aria-label={more} className="size-14 px-0 xl:size-9.5">
                <Ellipsis strokeWidth={1.5} aria-hidden />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">{more}</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end">
          <DropdownMenuItem className="md:hidden xl:flex min-[105rem]:hidden" onSelect={() => setDialog('reject')}>
            <XCircle strokeWidth={1.5} aria-hidden />{t('review.decide.reject')}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDialog('reoptimize')}>
            <RefreshCw strokeWidth={1.5} aria-hidden />{t('review.decide.reoptimize')}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDialog('suggest')}>
            <Truck strokeWidth={1.5} aria-hidden />{t('review.decide.suggest')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {dialog ? (
        <PlanDecisionDialog kind={dialog} revisionId={revisionId} vehicles={vehicles} currentVehicleId={currentVehicleId} onClose={() => setDialog(null)} />
      ) : null}
    </>
  )
}
