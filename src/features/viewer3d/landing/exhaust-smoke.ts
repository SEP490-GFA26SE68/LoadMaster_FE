import type { Vec3 } from '../scene/units'
import { departDistance, ENGINE_AT, ROLL_AT } from './story-timeline'

/**
 * Khói ở ống xả lúc xe rời kho trong khung 3D trang giới thiệu: hàm thuần của thời gian chuyện, không Three.js. Một cụm năm bụm khói lúc
 * nổ máy (`ENGINE_AT`), rồi một vệt bảy bụm nhỏ dần trong lúc xe lăn bánh. Mỗi bụm sinh ở miệng ống xả **tại chỗ xe đứng lúc đó** rồi ở
 * lại chỗ đó (xe chạy đi, khói ở lại phía sau), bay lên, dạt ra ngoài, nở to và nhạt dần; mọi bụm tan hết trước cuối chuyện.
 */

export type Puff = {
  /** Mốc sinh (ms của chuyện) */
  readonly birth: number
  /** Sống chừng này ms */
  readonly life: number
  /** Đường kính cuối (m) */
  readonly size: number
  /** Độ đục cao nhất */
  readonly peak: number
  /** Lệch nhỏ riêng của bụm (m): bụm khói không chồng khít lên nhau */
  readonly jitter: readonly [number, number]
}

/** Miệng ống xả (m, hệ của nhóm xe): sườn gần camera, ngay sau cabin, dưới sàn thùng. */
export const EXHAUST_AT: Vec3 = [0.3, -0.62, 2.42]

const BURST_MS = [0, 120, 260, 420, 600] as const
const TRAIL_COUNT = 7
const TRAIL_EVERY_MS = 220

/** Lệch giả ngẫu nhiên tất định trong [−1, 1]. */
const wobble = (seed: number) => Math.sin(seed * 12.9898) * 0.5 + Math.sin(seed * 78.233) * 0.5

export const PUFFS: readonly Puff[] = [
  ...BURST_MS.map((delay, index): Puff => ({
    birth: ENGINE_AT + delay, life: 2100, size: 2 - 0.12 * index, peak: 0.8, jitter: [0.12 * wobble(index + 1), 0.1 * wobble(index + 7)],
  })),
  ...Array.from({ length: TRAIL_COUNT }, (_, index): Puff => ({
    birth: ROLL_AT + 100 + TRAIL_EVERY_MS * index, life: 1500, size: 1.4 - 0.08 * index, peak: 0.62 - 0.04 * index,
    jitter: [0.1 * wobble(index + 13), 0.08 * wobble(index + 21)],
  })),
]

/** Mốc bụm cuối cùng tan hết. */
export const SMOKE_END = Math.max(...PUFFS.map((puff) => puff.birth + puff.life))
/** Mốc bụm đầu tiên sinh ra. */
export const SMOKE_START = Math.min(...PUFFS.map((puff) => puff.birth))

export type PuffFrame = { readonly center: Vec3; readonly size: number; readonly alpha: number }

/**
 * Bụm khói `puff` ở thời điểm `timeMs`; `null` khi chưa sinh hoặc đã tan. Tâm theo hệ của nhóm xe khi xe đứng chỗ cũ: miệng ống xả lùi về
 * đầu xe đúng quãng xe đã lăn lúc bụm sinh ra.
 */
export function puffAt(puff: Puff, timeMs: number): PuffFrame | null {
  const ageMs = timeMs - puff.birth
  if (ageMs < 0 || ageMs >= puff.life) return null
  const age = ageMs / 1000, k = ageMs / puff.life
  const [ox, oy, oz] = EXHAUST_AT
  return {
    center: [
      ox - departDistance(puff.birth) + 0.35 * age + puff.jitter[0],
      oy + 1.6 * (1 - Math.exp(-1.1 * age)) + 0.1 * age,
      oz + 1.1 * (1 - Math.exp(-1.8 * age)) + puff.jitter[1],
    ],
    size: puff.size * (0.3 + 0.7 * (1 - Math.exp(-1.8 * age))),
    alpha: puff.peak * Math.min(1, ageMs / 150) * (1 - k) ** 1.3,
  }
}

/** Có bụm khói nào đang bay không. */
export function smokeActive(timeMs: number): boolean {
  return timeMs >= SMOKE_START && timeMs < SMOKE_END
}
