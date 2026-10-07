import type { PickupStatus } from '@/lib/mock-db'

/** Tông và kiểu chấm của chip trạng thái yêu cầu nhận (ngữ pháp chấm của mục 5): chờ người kế tiếp là vòng rỗng, trạng thái là chấm đặc. */
export const PICKUP_STATUS_LOOK: Readonly<Record<PickupStatus, { tone: 'warning' | 'cyan' | 'danger' | 'azure' | 'success'; dot: 'solid' | 'ring' | 'halo' }>> = {
  PENDING: { tone: 'warning', dot: 'ring' },
  VALIDATED: { tone: 'cyan', dot: 'ring' },
  APPROVED: { tone: 'cyan', dot: 'solid' },
  REJECTED: { tone: 'danger', dot: 'solid' },
  LOADED: { tone: 'azure', dot: 'halo' },
  DELIVERED: { tone: 'success', dot: 'solid' },
}
