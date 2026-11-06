import { zodResolver } from '@hookform/resolvers/zod'
import { Move3d } from 'lucide-react'
import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { dataErrorMessage, useT } from '@/lib/i18n'
import { useRecordServerDeviationMutation } from './useServerWarehouseQuery'
import type { ServerPlacement } from './warehouse-server-api'

type DeviationValues = { x: string; y: string; z: string; reason: string }

const MAX_REASON = 500
const TOUCH = 'pointer-coarse:h-14 pointer-coarse:text-body-lg'

/**
 * Ghi sai lệch vị trí của kiện bước hiện tại (`POST /api/warehouse/placements/{id}/deviation`): vị trí thật sự đặt (cm, số nguyên như máy
 * chủ nhận) và lý do bắt buộc; mặc định là vị trí trong phương án. Máy chủ ghi kiện đã xếp kèm sai lệch rồi màn sang kiện kế tiếp. Máy chủ
 * từ chối thì câu lỗi ở trong hộp, không đóng.
 */
export function ServerDeviationDialog({ tripId, placement, step, open, onOpenChange }: {
  tripId: string
  placement: ServerPlacement
  step: number
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const record = useRecordServerDeviationMutation(tripId)
  const schema = useMemo(() => {
    const cm = z.string().trim().regex(/^\d+$/, t('serverWarehouse.deviation.numberRequired'))
    return z.object({
      x: cm,
      y: cm,
      z: cm,
      reason: z.string().trim().min(1, t('serverWarehouse.deviation.reasonRequired')).max(MAX_REASON, t('serverWarehouse.deviation.reasonTooLong')),
    })
  }, [t])
  const defaults = { x: String(Math.round(placement.x)), y: String(Math.round(placement.y)), z: String(Math.round(placement.z)), reason: '' }
  const form = useForm<DeviationValues>({ resolver: zodResolver(schema), defaultValues: defaults })

  function handleOpenChange(next: boolean) {
    if (!next) {
      form.reset(defaults)
      record.reset()
    }
    onOpenChange(next)
  }

  function handleSubmit(values: DeviationValues) {
    const input = { x: Number(values.x), y: Number(values.y), z: Number(values.z), reason: values.reason }
    record.mutate({ placementId: placement.id, input }, { onSuccess: () => handleOpenChange(false) })
  }

  const errors = form.formState.errors
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent sheet className="w-140">
        <form noValidate onSubmit={form.handleSubmit(handleSubmit)}>
          <DialogHeader
            icon={Move3d}
            tone="warning"
            title={t('serverWarehouse.deviation.title', { step })}
            description={t('serverWarehouse.deviation.description')}
          />
          <div className="flex flex-col gap-4 px-7 py-5 text-body-lg">
            <div className="grid grid-cols-3 gap-3">
              <Input numeric inputMode="numeric" className={TOUCH} label={t('serverWarehouse.deviation.x')} error={errors.x?.message} {...form.register('x')} />
              <Input numeric inputMode="numeric" className={TOUCH} label={t('serverWarehouse.deviation.y')} error={errors.y?.message} {...form.register('y')} />
              <Input numeric inputMode="numeric" className={TOUCH} label={t('serverWarehouse.deviation.z')} error={errors.z?.message} {...form.register('z')} />
            </div>
            <Textarea
              required
              label={t('serverWarehouse.deviation.reason')}
              hint={t('serverWarehouse.deviation.reasonHint')}
              error={errors.reason?.message}
              {...form.register('reason')}
            />
            {record.isError ? <p role="alert" className="m-0 text-body-lg text-danger">{dataErrorMessage(record.error, t)}</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" size="touch" onClick={() => handleOpenChange(false)}>{t('serverWarehouse.deviation.cancel')}</Button>
            <Button type="submit" variant="primary" size="touch" loading={record.isPending}>{t('serverWarehouse.deviation.submit')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
