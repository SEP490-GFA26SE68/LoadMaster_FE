import { useMemo, useState, type RefObject } from 'react'
import { landingPlans, type LandingPlan } from '../landing-plans'
import { LANDING_REQUEST } from '../landing-sample.mock'
import { useLandingSample } from '../useLandingSample'
import { useNearViewport } from '../useNearViewport'
import { savesData } from '../useStageGate'

export type JourneySample =
  | { readonly state: 'ready'; readonly plans: readonly LandingPlan[] }
  | { readonly state: 'pending' | 'off' | 'error'; readonly plans: null }

/**
 * Ba phương án của lần chạy mẫu cho bảng so và số của điểm 1 trong "Một chuyến hàng" — cùng truy vấn với khung 3D ở đầu trang
 * (`['landing', 'sample-candidates']`), nên khung đã tính thì bảng có số ngay, không chạy lần hai. Chưa chạy khi phần còn xa khung nhìn
 * (cách 800 px). `off`: người xem bật tiết kiệm dữ liệu, hoặc trình duyệt không có Web Worker — bộ tối ưu không chạy trên luồng chính
 * của trang trong lúc khách đang cuộn.
 */
export function useJourneySample<T extends Element>(): [RefObject<T | null>, JourneySample] {
  const [ref, near] = useNearViewport<T>()
  const [allowed] = useState(() => typeof Worker === 'function' && !savesData())
  const sample = useLandingSample(near && allowed)
  const plans = useMemo(() => (sample.data ? landingPlans(LANDING_REQUEST, sample.data) : null), [sample.data])
  const value: JourneySample = !allowed ? { state: 'off', plans: null }
    : sample.isError ? { state: 'error', plans: null }
      : plans ? { state: 'ready', plans }
        : { state: 'pending', plans: null }
  return [ref, value]
}
