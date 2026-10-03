import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/features/auth/AuthProvider'
import { NOTIFICATION_ACTIONS } from '@/features/notifications/notifications'
import { useFormat, useT } from '@/lib/i18n'
import { useFleetMonitoringQuery } from './useTrackingQuery'

/**
 * Canh nguy cơ trễ hạn cho người nhận thông báo đó ở chuông (FE-6-09: điều phối viên). Kho chỉ ghi điểm vị trí và tính lại ETA khi được
 * đọc, nên thành phần này — không vẽ gì, đứng cạnh chuông — đọc giám sát của các chuyến Đang vận chuyển theo nhịp điểm vị trí
 * (`useFleetMonitoringQuery`: không chuyến nào đang chạy thì không có nhịp nào). Cảnh báo kho phát **sau lần đọc đầu** hiện thành toast
 * (sát hạn: cảnh báo; trễ hạn dự kiến: lỗi) và chuông đọc lại ngay; cảnh báo đã có từ trước khi mở app chỉ nằm ở chuông.
 */
export function EtaRiskWatcher() {
  const { user } = useAuth()
  const watching = user !== null && NOTIFICATION_ACTIONS[user.role].includes('delivery.etaRisk')
  // Đổi người dùng là dựng lại: mốc "đã thấy" của người trước không dùng cho người sau
  return watching ? <Watcher key={user.id} /> : null
}

function Watcher() {
  const t = useT()
  const format = useFormat()
  const client = useQueryClient()
  const { data } = useFleetMonitoringQuery(true)
  const seen = useRef<Set<string> | null>(null)

  useEffect(() => {
    if (!data) return
    const alerts = data.flatMap((trip) => trip.alerts)
    const known = seen.current
    const fresh = alerts.filter((alert) => !known?.has(alert.eventId))
    seen.current = new Set([...(known ?? []), ...alerts.map((alert) => alert.eventId)])
    if (fresh.length === 0) return
    void client.invalidateQueries({ queryKey: ['notifications'] })
    if (known === null) return
    const moment = (at: string) => t('notifications.etaRisk.moment', { time: format.time(at), date: format.dayMonth(at) })
    for (const alert of fresh) {
      const show = alert.status === 'MISSED' ? toast.error : toast.warning
      show(t(`notifications.etaRisk.${alert.status}`, { tripId: alert.tripId, stop: format.integer(alert.stopNumber) }), {
        description: t('notifications.etaRisk.detail', { eta: moment(alert.eta), deadline: moment(alert.deadline) }),
      })
    }
  }, [data, client, t, format])

  return null
}
