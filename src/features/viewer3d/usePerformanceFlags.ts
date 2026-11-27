import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createQualityPolicy, observeQuality, type QualityObservation } from './quality-policy'

export type QualityTier = 'high' | 'balanced' | 'low'
export type AnimationQuality = 'full' | 'reduced' | 'none'
/** `landing`: khung 3D của trang giới thiệu công khai (`LandingStageViewer`) — chỉ xem, không thao tác. */
export type ExperienceMode = 'planner' | 'warehouse' | 'driver' | 'fleet' | 'landing'
/** `full`: cabin, bánh có gai / mâm và lớp chi tiết gộp (lưới tản nhiệt, gương, bậc, khung gầm…). `simple`: thân cabin, kính, bánh trơn và khung sườn. */
export type VehicleDetail = 'full' | 'simple'

/** Hiệu ứng chỉ thay đổi cách vẽ, không được loại bỏ trạng thái nghiệp vụ. */
export type PerformanceFlags = {
  tier: QualityTier
  shadows: boolean
  /** Viền tối chung; viền kiện đang chọn luôn được giữ lại. */
  outlines: boolean
  /**
   * Chi tiết phụ: chi tiết thùng (thước sàn, bản lề cửa), bề mặt kiện và cảnh trang trí của trang giới thiệu. Xe (cabin, bánh)
   * không theo cờ này — xe luôn được vẽ, chỉ đổi mức chi tiết theo `vehicleDetail`.
   */
  decoration: boolean
  vehicleDetail: VehicleDetail
  animationQuality: AnimationQuality
  postprocessing: false
  reducedMotion: boolean
  dpr: [number, number]
  onPerformanceSample: (sample: QualityObservation) => void
}

type QualityProfile = Omit<PerformanceFlags, 'tier' | 'reducedMotion' | 'onPerformanceSample'>

const PROFILES: Record<QualityTier, QualityProfile> = {
  high: {
    shadows: true,
    outlines: true,
    decoration: true,
    vehicleDetail: 'full',
    animationQuality: 'full',
    postprocessing: false,
    dpr: [1, 2],
  },
  balanced: {
    shadows: false,
    outlines: true,
    decoration: true,
    vehicleDetail: 'full',
    animationQuality: 'reduced',
    postprocessing: false,
    dpr: [1, 1.5],
  },
  low: {
    shadows: false,
    outlines: false,
    decoration: false,
    // Xe bản gọn: thêm vài draw call / vài trăm tam giác, đổi lại không bao giờ "mất xe" khi máy chậm
    vehicleDetail: 'simple',
    animationQuality: 'none',
    postprocessing: false,
    // DPR lúc chuyển động; cảnh nghỉ thì `RestDpr` vẽ lại một khung nét (`restDprOf`). DOM labels stay sharp at native resolution.
    dpr: [0.5, 0.5],
  },
}

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

/** Chỉ là cấu hình ban đầu; không suy diễn năng lực GPU từ kích thước màn hình. */
function detectInitialTier(): QualityTier {
  if (typeof navigator === 'undefined') return 'balanced'
  const cores = navigator.hardwareConcurrency ?? 4
  const memoryGb =
    (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4
  if (cores <= 2 || memoryGb <= 2) return 'low'
  return cores >= 8 && memoryGb >= 8 ? 'high' : 'balanced'
}

function readReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(REDUCED_MOTION_QUERY).matches
}

/** Override chỉ dùng ở luồng debug; không thêm tuỳ chọn kỹ thuật vào màn vận hành. */
export function usePerformanceFlags(tierOverride?: QualityTier, experience: ExperienceMode = 'planner'): PerformanceFlags {
  const [adaptiveTier, setAdaptiveTier] = useState<QualityTier>(() => {
    const detected = detectInitialTier()
    return experience !== 'planner' && detected === 'high' ? 'balanced' : detected
  })
  const policy = useRef(createQualityPolicy(adaptiveTier))
  const [reducedMotion, setReducedMotion] = useState(readReducedMotion)
  const tier = tierOverride ?? adaptiveTier
  const onPerformanceSample = useCallback((sample: QualityObservation) => {
    if (tierOverride) return // Explicit debug tier locks reproducible measurements.
    const previous = policy.current
    policy.current = observeQuality(previous, sample, performance.now())
    if (policy.current.tier !== previous.tier) setAdaptiveTier(policy.current.tier)
  }, [tierOverride])

  useEffect(() => {
    const query = window.matchMedia(REDUCED_MOTION_QUERY)
    function handleChange(event: MediaQueryListEvent) {
      setReducedMotion(event.matches)
    }
    query.addEventListener('change', handleChange)
    return () => query.removeEventListener('change', handleChange)
  }, [])

  return useMemo(() => ({
    ...PROFILES[tier],
    tier,
    reducedMotion,
    onPerformanceSample,
    // Không còn chuyển động lớn kể cả khi đổi tuỳ chọn hệ điều hành lúc đang xem.
    animationQuality: reducedMotion ? 'none' : PROFILES[tier].animationQuality,
  }), [tier, reducedMotion, onPerformanceSample])
}
