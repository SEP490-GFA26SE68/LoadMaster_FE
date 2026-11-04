import { toast } from 'sonner'
import { dataErrorMessage, useT } from '@/lib/i18n'
import type { DeliveryView } from './delivery-progress'
import type { IssueFormValues } from './issue-form.schema'
import { useArriveMutation, useCompleteStopMutation, useReportIssueMutation, useStartDeliveryMutation } from './useDriverQueries'

/**
 * Thao tác của tài xế ở điểm giao (LM-087, FE-6-06), ghi thẳng vào kho (D-47): xuất phát, "Đã đến", báo sự cố, hoàn tất điểm (sau hộp
 * hỏi lại `CompleteStopDialog`) — dỡ hàng đi qua hộp đối chiếu (`useUnloadScan`). Màn cảm ứng không bật toast thành công khi chính màn
 * đã cho thấy kết quả (banner giờ đến, dòng kiện, bước kế tiếp): chỉ ghi lỗi (lỗi của kho) và cảnh báo khách từ chối mới có toast.
 */
export function useDeliveryStop(tripId: string, view: DeliveryView | undefined) {
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
    void arrival.mutateAsync(number).catch(showError)
  }

  /** `true` khi kho đã ghi sự cố. */
  async function reportIssue({ packageInstanceId, kind, note }: IssueFormValues): Promise<boolean> {
    if (!view) return false
    try {
      await report.mutateAsync({ stopNumber: view.stop.number, packageInstanceId, kind, note })
      if (kind === 'refused') toast.warning(t('driver.issue.refusedRecorded', { id: packageInstanceId }), { description: t('driver.issue.refusedRecordedDescription') })
      return true
    } catch (error) {
      showError(error)
      return false
    }
  }

  /** `true` khi kho đã hoàn tất điểm đang giao; lỗi thì toast và `false` — hộp hỏi lại giữ nguyên. Không có toast thành công: màn sang điểm kế tiếp. */
  async function completeStop(): Promise<boolean> {
    if (!view) return false
    try {
      await complete.mutateAsync(view.stop.number)
      return true
    } catch (error) {
      showError(error)
      return false
    }
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
