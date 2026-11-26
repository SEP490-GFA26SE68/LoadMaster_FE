import { roundCm } from '@/domain/geometry'
import type { OptimizationRequest, OptimizationResult } from '@/domain/models'
import { candidateAxles, type CandidateAxles } from '@/lib/candidate-metrics'
import type { Formatter } from '@/lib/format'
import type { TFunction } from '@/lib/i18n'
import type { HowEntry } from '@/components/HowComputed'

/**
 * Số mà "Tính thế nào?" thay vào công thức của một phương án — đọc từ `result.metrics` của chính lần chạy và từ xe của chính request,
 * không tính lại phương án. Thuần, có test.
 */
export type PlanFacts = {
  readonly total: number
  readonly placed: number
  readonly unplaced: number
  readonly usedVolumeCm3: number
  readonly bodyVolumeCm3: number
  readonly volumePercent: number
  readonly usedKg: number
  readonly maxKg: number
  readonly payloadPercent: number
  readonly axles: CandidateAxles
  /** `null` khi kết quả không chia vùng theo điểm giao. */
  readonly rehandling: number | null
  /** Trọng tâm hàng theo chiều dài thùng, cm từ vách trước; `null` khi không kiện nào lên xe. */
  readonly centerXCm: number | null
  readonly middleXCm: number
}

export function planFacts(request: Pick<OptimizationRequest, 'vehicle'>, result: Pick<OptimizationResult, 'metrics'>): PlanFacts {
  const { metrics } = result
  return {
    total: metrics.placedCount + metrics.unplacedCount,
    placed: metrics.placedCount,
    unplaced: metrics.unplacedCount,
    usedVolumeCm3: metrics.usedVolumeCm3,
    bodyVolumeCm3: metrics.totalVehicleVolumeCm3,
    volumePercent: metrics.volumeUtilizationPercent,
    usedKg: metrics.usedPayloadKg,
    maxKg: metrics.maxPayloadKg,
    payloadPercent: metrics.payloadUtilizationPercent,
    axles: candidateAxles({ request, result }),
    rehandling: metrics.rehandlingCount ?? null,
    centerXCm: metrics.placedCount > 0 && metrics.centerOfGravityCm ? metrics.centerOfGravityCm.x : null,
    middleXCm: request.vehicle.innerLengthCm / 2,
  }
}

export type HowMetric = 'placed' | 'volume' | 'payload' | 'axleGap' | 'rehandling' | 'unplaced' | 'balance'

type Writer = (facts: PlanFacts, t: TFunction, format: Formatter) => string | null

const WRITERS: Record<HowMetric, Writer> = {
  placed: (facts, t, format) => t('landingHow.placed.text', { placed: format.integer(facts.placed), total: format.integer(facts.total) }),
  volume: (facts, t, format) => t('landingHow.volume.text', {
    placed: format.integer(facts.placed), used: format.volumeM3(facts.usedVolumeCm3), total: format.volumeM3(facts.bodyVolumeCm3),
    value: format.percent(facts.volumePercent),
  }),
  payload: (facts, t, format) => t('landingHow.payload.text', {
    placed: format.integer(facts.placed), used: format.weight(facts.usedKg), max: format.weight(facts.maxKg), value: format.percent(facts.payloadPercent),
  }),
  axleGap: ({ axles }, t, format) => {
    if (axles.status !== 'computed' || axles.gapPercent === undefined) return null
    const { front, rear } = axles
    if (front.limitKg === undefined || rear.limitKg === undefined || front.percent === undefined || rear.percent === undefined) return null
    return t('landingHow.axleGap.text', {
      frontLoad: format.weight(front.loadKg), frontLimit: format.weight(front.limitKg), front: format.percent(front.percent),
      rearLoad: format.weight(rear.loadKg), rearLimit: format.weight(rear.limitKg), rear: format.percent(rear.percent),
      value: format.decimal(axles.gapPercent),
    })
  },
  rehandling: (facts, t, format) => facts.rehandling === null ? null
    : t('landingHow.rehandling.text', { value: format.integer(facts.rehandling), placed: format.integer(facts.placed) }),
  unplaced: (facts, t, format) => t('landingHow.unplaced.text', {
    total: format.integer(facts.total), placed: format.integer(facts.placed), value: format.integer(facts.unplaced),
  }),
  balance: (facts, t, format) => facts.centerXCm === null ? null : t('landingHow.balance.text', {
    center: format.length(roundCm(facts.centerXCm)), middle: format.length(roundCm(facts.middleXCm)),
    value: format.length(roundCm(Math.abs(facts.centerXCm - facts.middleXCm))),
  }),
}

/** Các dòng giải thích theo đúng thứ tự `metrics`; số nào phương án không có (xe chưa khai trục, kết quả không chia vùng) thì bỏ dòng đó. */
export function howEntries(facts: PlanFacts, metrics: readonly HowMetric[], t: TFunction, format: Formatter): HowEntry[] {
  return metrics.flatMap((metric) => {
    const text = WRITERS[metric](facts, t, format)
    return text === null ? [] : [{ key: metric, label: t(`landingHow.${metric}.label`), text }]
  })
}
