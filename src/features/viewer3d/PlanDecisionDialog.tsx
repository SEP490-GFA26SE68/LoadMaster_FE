import { zodResolver } from '@hookform/resolvers/zod'
import { RefreshCw, Truck, XCircle } from 'lucide-react'
import { useMemo } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { RadioGroup, RadioGroupItem } from '@/components/ui/RadioGroup'
import { SelectField } from '@/components/ui/SelectField'
import { Textarea } from '@/components/ui/Textarea'
import type { VehicleConfig } from '@/domain/models'
import { useReviewDecisionMutation } from '@/features/review/useReviewQuery'
import { dataErrorMessage, useT } from '@/lib/i18n'
import {
  ANY_VEHICLE,
  DEFAULT_DECISION,
  decisionInput,
  decisionSchema,
  REASON_MAX,
  SUGGESTION_KINDS,
  type DecisionDialogKind,
  type DecisionValues,
} from './plan-decision'

const LOOK = {
  reject: { icon: XCircle, tone: 'danger' },
  reoptimize: { icon: RefreshCw, tone: 'warning' },
  suggest: { icon: Truck, tone: 'info' },
} as const

/**
 * Hộp thoại quyết định của quản lý công ty (LM-104): Từ chối, Yêu cầu tối ưu lại (lý do bắt buộc) hoặc Đề xuất đổi xe / tách chuyến
 * (loại, ghi chú bắt buộc, xe đề xuất tuỳ chọn). Gửi xong phương án rời hàng đợi và Planner hiện quyết định ở dòng dưới thanh trên;
 * lỗi của kho (bản không còn chờ duyệt…) hiện ngay trong hộp thoại.
 */
export function PlanDecisionDialog({ kind, revisionId, vehicles, currentVehicleId, onClose }: {
  kind: DecisionDialogKind
  revisionId: string
  vehicles: readonly VehicleConfig[]
  currentVehicleId: string | undefined
  onClose: () => void
}) {
  const t = useT()
  const mutation = useReviewDecisionMutation()
  const schema = useMemo(() => decisionSchema(t), [t])
  const form = useForm<DecisionValues>({ resolver: zodResolver(schema), defaultValues: DEFAULT_DECISION })
  const suggestion = useWatch({ control: form.control, name: 'suggestion' })
  const { icon, tone } = LOOK[kind]
  const vehicleOptions = [
    { value: ANY_VEHICLE, label: t('review.decide.anyVehicle') },
    ...vehicles.filter((vehicle) => vehicle.id !== currentVehicleId).map((vehicle) => ({ value: vehicle.id, label: vehicle.name })),
  ]

  function submit(values: DecisionValues) {
    mutation.mutate(decisionInput(kind, revisionId, values), {
      onSuccess: (decision) => {
        toast.success(t(`review.decide.done.${decision.kind}`))
        onClose()
      },
    })
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="w-140" data-plan-decision-dialog={kind}>
        <form onSubmit={form.handleSubmit(submit)} noValidate className="flex flex-col">
          <DialogHeader icon={icon} tone={tone} title={t(`review.decide.dialogs.${kind}.title`)} description={t(`review.decide.dialogs.${kind}.description`)} />
          <div className="flex flex-col gap-4 px-7 py-5">
            {kind === 'suggest' ? (
              <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
                <legend className="mb-1 text-small font-semibold text-ink-2">{t('review.decide.kind')}</legend>
                <RadioGroup aria-label={t('review.decide.kind')} value={suggestion} className="flex-row gap-6"
                  onValueChange={(value) => {
                    const code = SUGGESTION_KINDS.find((item) => item === value)
                    if (code) form.setValue('suggestion', code)
                  }}>
                  {SUGGESTION_KINDS.map((code) => <RadioGroupItem key={code} value={code} label={t(`review.decide.kinds.${code}`)} />)}
                </RadioGroup>
              </fieldset>
            ) : null}
            {kind === 'suggest' && suggestion === 'change_vehicle' ? (
              <SelectField control={form.control} name="vehicleId" label={t('review.decide.vehicle')} hint={t('review.decide.vehicleHint')} options={vehicleOptions} />
            ) : null}
            <Textarea
              label={t(kind === 'suggest' ? 'review.decide.note' : 'review.decide.reason')}
              hint={t('review.decide.reasonHint')}
              error={form.formState.errors.reason?.message}
              rows={3}
              maxLength={REASON_MAX}
              {...form.register('reason')}
            />
            {mutation.error ? <p role="alert" className="m-0 text-small text-danger">{dataErrorMessage(mutation.error, t)}</p> : null}
          </div>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="secondary">{t('review.decide.cancel')}</Button></DialogClose>
            <Button type="submit" variant={kind === 'reject' ? 'danger' : 'primary'} loading={mutation.isPending} disabled={mutation.isPending}>
              {t(`review.decide.dialogs.${kind}.submit`)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
