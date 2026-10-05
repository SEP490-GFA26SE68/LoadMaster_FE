import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/features/auth/AuthProvider'
import { NOTIFICATION_ACTIONS } from '@/features/notifications/notifications'
import { useFormat, useT } from '@/lib/i18n'
import type { AuditAction } from '@/lib/mock-db'
import type { Role } from '@/types/user'
import { useFleetMonitoringQuery } from './useTrackingQuery'

/** Thông báo ở chuông mà kho chỉ ghi ra khi có người đọc giám sát: nguy cơ trễ hạn (FE-6-09), sự cố tự chuyển quản lý (FE-6-11). */
const WATCHED: readonly AuditAction[] = ['delivery.etaRisk', 'exception.escalated']

/**
 * Canh nguy cơ trễ hạn và sự cố chuyển lên quản lý cho người nhận các thông báo đó ở chuông (FE-6-09: điều phối viên; FE-6-11: thêm
 * quản lý công ty). Kho chỉ ghi điểm vị trí, tính lại ETA và tự chuyển sự cố quá 30 phút khi được đọc, nên thành phần này — không vẽ
 * gì, đứng cạnh chuông — đọc giám sát của các chuyến Đang vận chuyển theo nhịp điểm vị trí (`useFleetMonitoringQuery`: không chuyến
 * nào đang chạy thì không có nhịp nào). Việc kho phát **sau lần đọc đầu** hiện thành toast (sát hạn: cảnh báo; trễ hạn dự kiến: lỗi;
 * sự cố chuyển quản lý: cảnh báo — không báo việc chính mình vừa làm) và chuông đọc lại ngay; việc đã có từ trước khi mở app chỉ nằm ở
 * chuông.
 */
export function EtaRiskWatcher() {
  const { user } = useAuth()
  const watching = user !== null && WATCHED.some((action) => NOTIFICATION_ACTIONS[user.role].includes(action))
  // Đổi người dùng là dựng lại: mốc "đã thấy" của người trước không dùng cho người sau
  return watching ? <Watcher key={user.id} userId={user.id} role={user.role} /> : null
}

function Watcher({ userId, role }: { userId: string; role: Role }) {
  const t = useT()
  const format = useFormat()
  const client = useQueryClient()
  const { data } = useFleetMonitoringQuery(true)
  const seen = useRef<Set<string> | null>(null)

  useEffect(() => {
    if (!data) return
    const actions = NOTIFICATION_ACTIONS[role]
    const alerts = actions.includes('delivery.etaRisk') ? data.flatMap((trip) => trip.alerts) : []
    const escalated = actions.includes('exception.escalated')
      ? data.flatMap((trip) => trip.exceptions).filter((exception) => exception.escalation !== undefined)
      : []
    const keys = [...alerts.map((alert) => alert.eventId), ...escalated.map((exception) => `escalated:${exception.id}`)]
    const known = seen.current
    const fresh = new Set(keys.filter((key) => !known?.has(key)))
    seen.current = new Set([...(known ?? []), ...keys])
    if (fresh.size === 0) return
    void client.invalidateQueries({ queryKey: ['notifications'] })
    if (known === null) return
    const moment = (at: string) => t('notifications.etaRisk.moment', { time: format.time(at), date: format.dayMonth(at) })
    for (const alert of alerts.filter((item) => fresh.has(item.eventId))) {
      const show = alert.status === 'MISSED' ? toast.error : toast.warning
      show(t(`notifications.etaRisk.${alert.status}`, { tripId: alert.tripId, stop: format.integer(alert.stopNumber) }), {
        description: t('notifications.etaRisk.detail', { eta: moment(alert.eta), deadline: moment(alert.deadline) }),
      })
    }
    for (const exception of escalated.filter((item) => fresh.has(`escalated:${item.id}`) && item.escalation?.by !== userId)) {
      toast.warning(t('notifications.exceptionEscalated', { tripId: exception.tripId, type: t(`common.tripExceptionTypes.${exception.type}`) }))
    }
  }, [data, client, t, format, role, userId])

  return null
}
