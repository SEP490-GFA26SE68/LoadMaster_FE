import type { UseFormReturn } from 'react-hook-form'
import { toast } from 'sonner'
import { parseCoordinates } from '@/components/map'
import { backendTimeMs } from '@/lib/backend-time'
import { dataErrorMessage, useT } from '@/lib/i18n'
import type { DeliveryRequirement } from '@/lib/mock-db'
import { deadlineVietnamLocal, initialValues, type RequirementFormValues } from './requirement-form'
import {
  useExtendRequirementDeadlineMutation,
  useUpdateRequirementCoordinatesMutation,
  useUpdateRequirementScheduleMutation,
} from './useRequirementFormQuery'

/**
 * Ba lần lưu riêng của form yêu cầu giao (máy chủ) khi yêu cầu đã khoá phần còn lại: thêm toạ độ còn thiếu, đổi hạn / ưu tiên khi chuyến
 * còn Nháp hoặc Đã lập kế hoạch, gia hạn khi chuyến Đang vận chuyển. Lưu xong toast rồi đóng hộp thoại; lỗi là toast.
 */
export function useRequirementSideSaves({ current, form, canAddCoordinates, canEditSchedule, canExtendDeadline, extensionReason, onClose }: {
  current: DeliveryRequirement | undefined
  form: UseFormReturn<RequirementFormValues>
  canAddCoordinates: boolean
  canEditSchedule: boolean
  canExtendDeadline: boolean
  extensionReason: string
  onClose: () => void
}) {
  const t = useT()
  const updateCoordinates = useUpdateRequirementCoordinatesMutation()
  const updateSchedule = useUpdateRequirementScheduleMutation()
  const extendDeadline = useExtendRequirementDeadlineMutation()
  const showError = (error: Error) => toast.error(dataErrorMessage(error, t))
  const savedAndClose = (key: 'requirements.form.coordinatesSaved' | 'requirements.form.savedSchedule' | 'requirements.form.deadlineExtended') => () => {
    toast.success(t(key))
    onClose()
  }

  function saveCoordinates() {
    if (!current || !canAddCoordinates) return
    const coordinates = form.getValues('coordinates')
    const parsed = parseCoordinates(coordinates.lat, coordinates.lng)
    if (parsed.kind !== 'ok') {
      toast.error(t('requirements.form.errors.coordinatesInvalid'))
      return
    }
    updateCoordinates.mutate(
      { id: current.id, lat: parsed.lat, lng: parsed.lng },
      { onSuccess: savedAndClose('requirements.form.coordinatesSaved'), onError: showError },
    )
  }

  function scheduleDeadline(): string | null {
    const values = form.getValues()
    const deadline = deadlineVietnamLocal(values.deadlineDate, values.deadlineTime)
    if (!deadline) {
      toast.error(t('requirements.form.errors.deadlineInvalid'))
      return null
    }
    // Spring Boot LocalDateTime sử dụng giờ Việt Nam.
    const deadlineMs = backendTimeMs(deadline)
    if (!Number.isFinite(deadlineMs) || deadlineMs <= Date.now()) {
      toast.error(t('requirements.form.errors.deadlinePast'))
      return null
    }
    return deadline
  }

  function saveSchedule() {
    if (!current || !canEditSchedule) return
    const values = form.getValues()
    const original = initialValues(current)
    const deadlineChanged = values.deadlineDate !== original.deadlineDate || values.deadlineTime !== original.deadlineTime
    // Không bắt nhập lại hạn giao tương lai nếu Dispatcher chỉ thay đổi ưu tiên.
    const deadline = deadlineChanged ? scheduleDeadline() : undefined
    if (deadlineChanged && !deadline) return
    updateSchedule.mutate(
      { id: current.id, deadline: deadline ?? undefined, priority: values.priority },
      { onSuccess: savedAndClose('requirements.form.savedSchedule'), onError: showError },
    )
  }

  function extend() {
    if (!current || !canExtendDeadline) return
    const reason = extensionReason.trim()
    if (!reason || reason.length > 500) {
      toast.error(t('requirements.form.extensionReasonRequired'))
      return
    }
    const newDeadline = scheduleDeadline()
    if (!newDeadline) return
    const newDeadlineMs = backendTimeMs(newDeadline)
    const previousDeadlineMs = Date.parse(current.deadline)
    if (newDeadlineMs <= previousDeadlineMs) {
      toast.error(t('requirements.form.extensionMustBeLater'))
      return
    }
    extendDeadline.mutate(
      { id: current.id, newDeadline, reason },
      { onSuccess: savedAndClose('requirements.form.deadlineExtended'), onError: showError },
    )
  }

  return { updateCoordinates, updateSchedule, extendDeadline, saveCoordinates, saveSchedule, extend }
}
