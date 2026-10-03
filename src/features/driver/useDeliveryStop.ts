import { toast } from 'sonner'
import { dataErrorMessage, useT } from '@/lib/i18n'
import type { DeliveryView } from './delivery-progress'
import type { IssueFormValues } from './issue-form.schema'
import { useArriveMutation, useCompleteStopMutation, useReportIssueMutation, useStartDeliveryMutation } from './useDriverQueries'

/**
 * Thao tác của tài xế ở điểm giao (LM-087, FE-6-06), ghi thẳng vào kho (D-47): xuất phát, "Đã đến", báo sự cố, hoàn tất điểm — dỡ hàng
 * đi qua hộp đối chiếu (`useUnloadScan`). Toast chỉ nói việc kho đã ghi; ghi lỗi thì nói lỗi của kho. Dùng promise (không dùng callback
 * theo lượt `mutate`) cho việc cần báo sau khi màn đã đổi, ví dụ hoàn tất điểm cuối mở màn tổng kết.
 */
export function useDeliveryStop(tripId: string, view: DeliveryView | undefined, stopCount: number) {
  const t = useT()
  const start = useStartDeliveryMutation(tripId)
  const arrival = useArriveMutation(tripId)
  const report = useReportIssueMutation(tripId)
  const complete = useCompleteStopMutation(tripId)

  function showError(error: unknown) {
    toast.error(dataErrorMessage(error, t))
  }

  function startDelivery() {
    void start.mutateAsync().catch(showError)
  }

  /** Ghi giờ đến điểm đang giao: từ lúc này mới dỡ hàng được. */
  function arrive() {
    if (view?.mode !== 'delivering') return
    const number = view.stop.number
    void arrival.mutateAsync(number).then(() => toast.success(t('driver.arrived', { number })), showError)
  }

  /** `true` khi kho đã ghi sự cố. */
  async function reportIssue({ packageInstanceId, kind, note }: IssueFormValues): Promise<boolean> {
    if (!view) return false
    try {
      await report.mutateAsync({ stopNumber: view.stop.number, packageInstanceId, kind, note })
      if (kind === 'refused') toast.warning(t('driver.issue.refusedRecorded', { id: packageInstanceId }), { description: t('driver.issue.refusedRecordedDescription') })
      else toast.success(t('driver.issue.recorded', { id: packageInstanceId }))
      return true
    } catch (error) {
      showError(error)
      return false
    }
  }

  function completeStop() {
    if (!view) return
    const number = view.stop.number
    void complete.mutateAsync(number).then(
      () => toast.success(t('driver.stopDone', { number }), {
        description: number >= stopCount ? t('driver.lastStop') : t('driver.nextStop', { number: number + 1 }),
      }),
      showError,
    )
  }

  return {
    startDelivery,
    starting: start.isPending,
    arrive,
    arriving: arrival.isPending,
    reportIssue,
    reporting: report.isPending,
    completeStop,
    completing: complete.isPending,
  }
}
