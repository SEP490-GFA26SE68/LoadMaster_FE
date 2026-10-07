import { zodResolver } from '@hookform/resolvers/zod'
import { CircleCheck, PackageCheck, Printer } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'
import { Banner } from '@/components/Banner'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/Textarea'
import { useCan } from '@/features/auth/useCan'
import { labelsPath } from '@/features/package-pool/packages-list'
import { dataErrorMessage, useT } from '@/lib/i18n'
import { MAX_PICKUP_REASON_LENGTH, type PickupApproval } from '@/lib/mock-db'
import { PickupRulesList } from './PickupRulesList'
import type { PickupRow } from './pickups-api'
import { useApprovePickupMutation, useValidatePickupMutation } from './usePickupsQuery'

/** Lỗi của form là mã; component dịch. */
const schema = z.object({ reason: z.string().trim().max(MAX_PICKUP_REASON_LENGTH, 'reasonTooLong') })
type ApproveValues = z.infer<typeof schema>

/**
 * Hộp "Duyệt yêu cầu nhận hàng" (FE-7-04, D-88) của điều phối viên. Mở hộp là kiểm lại mười luật theo chuyến lúc này (xe đã đi tiếp từ lúc
 * gửi yêu cầu). Đạt cả mười thì duyệt ngay; còn luật không đạt thì **lý do vượt luật là bắt buộc** — nút Duyệt không chặn bằng cách mờ mà
 * báo thiếu lý do ngay ô nhập, vì ô lý do nằm ngay trên nút. Duyệt xong hộp chuyển sang bước "Đã duyệt": kiện nhận kèm mã QR và nút
 * "In nhãn gửi bên gửi" mở `/kien-hang/nhan?kien=…` (cần `labels.print`). Thân hộp dựng lại mỗi lần mở.
 */
export function PickupApproveDialog({ tripId, row, stopLabel, onOpenChange }: {
  tripId: string
  /** Yêu cầu sắp duyệt; `null` là hộp đóng. */
  row: PickupRow | null
  stopLabel: (stopId: string) => string
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={row !== null} onOpenChange={onOpenChange}>
      {row ? (
        <DialogContent className="w-[min(46rem,calc(100vw-3rem))]">
          <ApproveBody tripId={tripId} row={row} stopLabel={stopLabel} onClose={() => onOpenChange(false)} />
        </DialogContent>
      ) : null}
    </Dialog>
  )
}

function ApproveBody({ tripId, row, stopLabel, onClose }: { tripId: string; row: PickupRow; stopLabel: (stopId: string) => string; onClose: () => void }) {
  const t = useT()
  const { request } = row
  const validate = useValidatePickupMutation(tripId)
  const approve = useApprovePickupMutation(tripId)
  const [approved, setApproved] = useState<PickupApproval | null>(null)
  const form = useForm<ApproveValues>({ resolver: zodResolver(schema), defaultValues: { reason: '' } })
  const { mutate: check } = validate
  useEffect(() => {
    check(request.id)
  }, [check, request.id])

  const results = validate.data?.validationResults ?? request.validationResults
  const failed = results.filter((result) => !result.passed).length
  const reasonError = form.formState.errors.reason?.message
  const errorText = reasonError === 'reasonRequired'
    ? t('pickups.approve.reasonRequired')
    : reasonError === 'reasonTooLong' ? t('pickups.approve.reasonTooLong', { max: MAX_PICKUP_REASON_LENGTH }) : undefined

  if (approved) return <ApprovedBody approval={approved} onClose={onClose} />

  function handleApprove({ reason }: ApproveValues) {
    if (failed > 0 && reason === '') {
      form.setError('reason', { message: 'reasonRequired' })
      return
    }
    approve.mutate({ pickupId: request.id, input: failed > 0 ? { overrideReason: reason } : {} }, {
      onSuccess: (result) => {
        toast.success(t('pickups.approve.done', { id: request.id }))
        setApproved(result)
      },
    })
  }

  return (
    <form noValidate onSubmit={form.handleSubmit(handleApprove)}>
      <DialogHeader icon={PackageCheck} title={t('pickups.approve.title', { id: request.id })} description={t('pickups.approve.description')} />
      <div className="flex max-h-[calc(100dvh-16rem)] flex-col gap-3 overflow-y-auto px-7 py-5">
        {validate.isPending && results.length === 0 ? (
          <div role="status" className="flex items-center gap-2 text-small text-ink-2"><Spinner />{t('pickups.approve.checking')}</div>
        ) : (
          <>
            <Banner tone={failed === 0 ? 'info' : 'warning'}>{failed === 0 ? t('pickups.approve.allPassed') : t('pickups.approve.someFailed', { count: failed })}</Banner>
            <PickupRulesList results={results} stopLabel={stopLabel} />
          </>
        )}
        {failed > 0 ? (
          <Textarea label={t('pickups.approve.reason')} hint={t('pickups.approve.reasonHint')} error={errorText} rows={3} aria-required {...form.register('reason')} />
        ) : null}
        {validate.isError ? <p role="alert" className="m-0 text-caption text-danger">{dataErrorMessage(validate.error, t)}</p> : null}
        {approve.isError ? <p role="alert" className="m-0 text-caption text-danger">{dataErrorMessage(approve.error, t)}</p> : null}
      </div>
      <DialogFooter>
        <DialogClose asChild><Button type="button" variant="secondary">{t('pickups.approve.cancel')}</Button></DialogClose>
        <Button type="submit" loading={approve.isPending} disabled={validate.isPending}>{t('pickups.approve.confirm')}</Button>
      </DialogFooter>
    </form>
  )
}

/** Bước sau khi duyệt: kiện nhận kèm mã QR, và lối in nhãn gửi bên gửi. */
function ApprovedBody({ approval, onClose }: { approval: PickupApproval; onClose: () => void }) {
  const t = useT()
  const can = useCan()
  const { request, packages } = approval
  return (
    <div>
      <DialogHeader icon={CircleCheck} tone="success" title={t('pickups.approve.doneTitle', { id: request.id })} description={t('pickups.approve.doneDescription', { count: packages.length })} />
      <div className="flex max-h-[calc(100dvh-16rem)] flex-col gap-2 overflow-y-auto px-7 py-5">
        <h3 className="m-0 font-display text-body font-[650] text-ink-strong">{t('pickups.approve.packages')}</h3>
        <ul className="m-0 flex list-none flex-col divide-y divide-line-soft rounded-md border border-border p-0">
          {packages.map((pkg) => (
            <li key={pkg.id} className="flex flex-wrap items-baseline gap-x-3 px-3.5 py-2 font-mono text-small tabular-nums text-ink-1">
              <span className="font-semibold">{pkg.id}</span>
              <span>{t('pickups.approve.packageRow', { code: pkg.packageCode, qr: pkg.qrToken })}</span>
            </li>
          ))}
        </ul>
      </div>
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onClose}>{t('pickups.approve.close')}</Button>
        {can('labels.print') ? (
          <Button asChild>
            <Link to={labelsPath(packages.map((pkg) => pkg.id))}>
              <Printer strokeWidth={1.5} />
              {t('pickups.actions.printLabels')}
            </Link>
          </Button>
        ) : null}
      </DialogFooter>
    </div>
  )
}
