import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { isApiError } from '@/lib/api-client'
import { isMockDbError, type DriverLocationInput } from '@/lib/mock-db'
import { postDriverLocation, setDriverGps } from './driver-api'

/** Nhịp gửi vị trí của điện thoại tài xế: 30 giây, bằng nhịp ghi vị trí của kho. */
export const GPS_SEND_INTERVAL_MS = 30_000

/** Gửi hỏng tạm thời thì thử lại sau 1, 2 rồi 4 nhịp (30 → 60 → 120 giây), không thưa hơn 120 giây. */
const MAX_RETRY_TICKS = 4

/** Vì sao GPS thật đang tắt: tài xế tắt, trình duyệt từ chối quyền, thiết bị không hỗ trợ, hoặc kho / máy chủ từ chối điểm vị trí. */
export type GpsStopReason = 'user' | 'denied' | 'unsupported' | 'error'

export type DeviceLocationState =
  | { readonly status: 'off'; readonly reason?: GpsStopReason; readonly error?: unknown }
  /** Đã bật, đang chờ quyền vị trí và điểm GPS đầu tiên. */
  | { readonly status: 'requesting' }
  /** Đang gửi; `sentAt` là giờ kho ghi điểm vị trí gần nhất. */
  | { readonly status: 'active'; readonly sentAt: string }
  /**
   * Vẫn đang chia sẻ nhưng chưa gửi được: `send` — lần gửi gần nhất hỏng tạm thời (mất mạng, máy chủ lỗi, quá giờ), nhịp sau thử lại;
   * `signal` — trình duyệt tạm mất tín hiệu GPS, gửi tiếp ngay khi có vị trí mới.
   */
  | { readonly status: 'retrying'; readonly cause: 'send' | 'signal'; readonly sentAt?: string }

type Coordinates = Pick<GeolocationCoordinates, 'latitude' | 'longitude' | 'speed' | 'heading'>

/** Điểm vị trí gửi kho từ toạ độ của trình duyệt: tốc độ m/s → km/h (làm tròn 0,1), hướng về [0, 360); thiếu hoặc không đọc được là 0. */
export function locationInput({ latitude, longitude, speed, heading }: Coordinates): DriverLocationInput {
  const speedKmh = speed !== null && Number.isFinite(speed) && speed > 0 ? Math.round(speed * 36) / 10 : 0
  const degrees = heading !== null && Number.isFinite(heading) ? ((Math.round(heading) % 360) + 360) % 360 : 0
  return { lat: latitude, lng: longitude, speedKmh, heading: degrees }
}

/**
 * Lỗi gửi vị trí có đáng thử lại không: không có phản hồi (mất mạng, quá giờ — `status` 0), máy chủ lỗi 5xx, hoặc lỗi lạ của trình duyệt
 * là tạm thời. Máy chủ trả 4xx (chuyến không còn Đang vận chuyển…) hay kho mẫu từ chối là dứt khoát: thử lại cũng vậy.
 */
export function isTransientLocationError(error: unknown): boolean {
  if (isMockDbError(error)) return false
  if (isApiError(error)) return error.status === 0 || error.status >= 500
  return true
}

const isSupported = () => typeof navigator !== 'undefined' && 'geolocation' in navigator

/**
 * "Dùng GPS thật" của tài xế (FE-6-13, D-85, D-95). Bật: xin quyền vị trí qua `watchPosition`, báo kho để đồng hồ mô phỏng chạy theo
 * giờ thật, gửi điểm GPS đầu tiên ngay rồi gửi vị trí mới nhất mỗi 30 giây (`postDriverLocation`). Gửi hỏng tạm thời
 * (`isTransientLocationError`) vẫn giữ chia sẻ: trạng thái `retrying`, thử lại sau 30 → 60 → 120 giây; tạm mất tín hiệu GPS cũng giữ
 * chia sẻ và gửi ngay khi có vị trí mới. Tài xế tắt, trình duyệt từ chối quyền hoặc kho / máy chủ từ chối điểm vị trí: thôi theo dõi và báo kho — vị trí xe về mô phỏng — kèm lý do để màn nói ra.
 * Gỡ màn chuyến (rời màn, chuyến giao xong) cũng dừng như vậy. Khi chưa có máy chủ, điểm GPS chỉ nằm trong kho của tab này.
 */
export function useDeviceLocation(tripId: string) {
  const client = useQueryClient()
  const [enabled, setEnabled] = useState(false)
  const [state, setState] = useState<DeviceLocationState>({ status: 'off' })

  useEffect(() => {
    if (!enabled) return
    let latest: DriverLocationInput | null = null
    let stopped = false
    let sending = false
    let sentAt: string | undefined
    let signalLost = false
    // Sau lần hỏng thứ n, chờ min(2^(n-1), 4) nhịp mới gửi lại; `waited` đếm nhịp đã qua kể từ lần hỏng
    let failures = 0
    let waited = 0
    const stop = (reason: GpsStopReason, error?: unknown) => {
      if (stopped) return
      stopped = true
      setEnabled(false)
      setState({ status: 'off', reason, error })
    }
    const send = () => {
      if (latest === null || stopped || sending) return
      sending = true
      postDriverLocation(tripId, latest).then(
        (point) => {
          sending = false
          if (stopped) return
          failures = 0
          sentAt = point.recordedAt
          setState({ status: 'active', sentAt: point.recordedAt })
          // Màn giám sát mở trong cùng tab đọc lại vị trí và ETA
          void client.invalidateQueries({ queryKey: ['trips', tripId, 'monitoring'] })
          void client.invalidateQueries({ queryKey: ['trips', 'monitoring'] })
        },
        (error: unknown) => {
          sending = false
          if (stopped) return
          if (!isTransientLocationError(error)) {
            stop('error', error)
            return
          }
          failures += 1
          waited = 0
          setState({ status: 'retrying', cause: 'send', sentAt })
        },
      )
    }
    const tick = () => {
      // Không gửi lại vị trí cũ khi đang mất tín hiệu
      if (signalLost) return
      if (failures > 0) {
        waited += 1
        if (waited < Math.min(2 ** (failures - 1), MAX_RETRY_TICKS)) return
      }
      send()
    }
    setDriverGps(tripId, true).catch((error: unknown) => stop('error', error))
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const resume = latest === null || signalLost
        signalLost = false
        latest = locationInput(position.coords)
        if (resume) send()
      },
      // Mất tín hiệu, quá giờ chờ vị trí là tạm thời: trình duyệt vẫn theo dõi và báo vị trí mới khi có lại
      (error) => {
        if (error.code === 1) {
          stop('denied')
          return
        }
        signalLost = true
        setState({ status: 'retrying', cause: 'signal', sentAt })
      },
      { enableHighAccuracy: true, maximumAge: 10_000 },
    )
    const timer = setInterval(tick, GPS_SEND_INTERVAL_MS)
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
