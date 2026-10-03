import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { postDriverLocation, setDriverGps } from '@/features/monitoring/monitoring-api'
import type { DriverLocationInput } from '@/lib/mock-db'

/** Nhịp gửi vị trí của điện thoại tài xế: 30 giây, bằng nhịp ghi vị trí của kho. */
export const GPS_SEND_INTERVAL_MS = 30_000

/** Vì sao GPS thật đang tắt: tài xế tắt, trình duyệt từ chối quyền, mất tín hiệu, thiết bị không hỗ trợ, hoặc kho từ chối điểm vị trí. */
export type GpsStopReason = 'user' | 'denied' | 'lost' | 'unsupported' | 'error'

export type DeviceLocationState =
  | { readonly status: 'off'; readonly reason?: GpsStopReason; readonly error?: unknown }
  /** Đã bật, đang chờ quyền vị trí và điểm GPS đầu tiên. */
  | { readonly status: 'requesting' }
  /** Đang gửi; `sentAt` là giờ kho ghi điểm vị trí gần nhất. */
  | { readonly status: 'active'; readonly sentAt: string }

type Coordinates = Pick<GeolocationCoordinates, 'latitude' | 'longitude' | 'speed' | 'heading'>

/** Điểm vị trí gửi kho từ toạ độ của trình duyệt: tốc độ m/s → km/h (làm tròn 0,1), hướng về [0, 360); thiếu hoặc không đọc được là 0. */
export function locationInput({ latitude, longitude, speed, heading }: Coordinates): DriverLocationInput {
  const speedKmh = speed !== null && Number.isFinite(speed) && speed > 0 ? Math.round(speed * 36) / 10 : 0
  const degrees = heading !== null && Number.isFinite(heading) ? ((Math.round(heading) % 360) + 360) % 360 : 0
  return { lat: latitude, lng: longitude, speedKmh, heading: degrees }
}

const isSupported = () => typeof navigator !== 'undefined' && 'geolocation' in navigator

/**
 * "Dùng GPS thật" của tài xế (FE-6-13, D-85, D-95). Bật: xin quyền vị trí qua `watchPosition`, báo kho để đồng hồ mô phỏng chạy theo
 * giờ thật, gửi điểm GPS đầu tiên ngay rồi gửi vị trí mới nhất mỗi 30 giây (`postDriverLocation`). Tài xế tắt, trình duyệt từ chối
 * quyền, mất tín hiệu hoặc kho từ chối điểm vị trí: thôi theo dõi và báo kho — vị trí xe về mô phỏng — kèm lý do để màn nói ra. Gỡ màn
 * chuyến (rời màn, chuyến giao xong) cũng dừng như vậy. Khi chưa có máy chủ, điểm GPS chỉ nằm trong kho của tab này.
 */
export function useDeviceLocation(tripId: string) {
  const client = useQueryClient()
  const [enabled, setEnabled] = useState(false)
  const [state, setState] = useState<DeviceLocationState>({ status: 'off' })

  useEffect(() => {
    if (!enabled) return
    let latest: DriverLocationInput | null = null
    let stopped = false
    const stop = (reason: GpsStopReason, error?: unknown) => {
      if (stopped) return
      stopped = true
      setEnabled(false)
      setState({ status: 'off', reason, error })
    }
    const send = () => {
      if (latest === null || stopped) return
      postDriverLocation(tripId, latest).then(
        (point) => {
          if (stopped) return
          setState({ status: 'active', sentAt: point.recordedAt })
          // Màn giám sát mở trong cùng tab đọc lại vị trí và ETA
          void client.invalidateQueries({ queryKey: ['trips', tripId, 'monitoring'] })
          void client.invalidateQueries({ queryKey: ['trips', 'monitoring'] })
        },
        (error: unknown) => stop('error', error),
      )
    }
    setDriverGps(tripId, true).catch((error: unknown) => stop('error', error))
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const first = latest === null
        latest = locationInput(position.coords)
        if (first) send()
      },
      (error) => stop(error.code === 1 ? 'denied' : 'lost'),
      { enableHighAccuracy: true, maximumAge: 10_000 },
    )
    const timer = setInterval(send, GPS_SEND_INTERVAL_MS)
    return () => {
      stopped = true
      navigator.geolocation.clearWatch(watchId)
      clearInterval(timer)
      // Kho thôi chờ GPS: xe mô phỏng ghi tiếp, đồng hồ về tốc độ đã đặt
      setDriverGps(tripId, false).catch(() => undefined)
    }
  }, [enabled, tripId, client])

  function toggle(next: boolean) {
    if (next && !isSupported()) {
      setState({ status: 'off', reason: 'unsupported' })
      return
    }
    setEnabled(next)
    setState(next ? { status: 'requesting' } : { status: 'off', reason: 'user' })
  }

  return { supported: isSupported(), enabled, state, toggle }
}
