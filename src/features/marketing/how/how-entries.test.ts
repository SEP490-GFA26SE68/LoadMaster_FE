import { expect, test } from 'vitest'
import type { OptimizationResult } from '@/domain/models'
import { createFormatter } from '@/lib/format'
import { createTranslator } from '@/lib/i18n'
import { twoAxles } from '@/lib/mock-db/seed-vehicles'
import { howEntries, planFacts, type HowMetric } from './how-entries'

const t = createTranslator('vi')
const format = createFormatter('vi-VN')

/** Thùng dài 600 cm, trục trước giới hạn 4.000 kg, trục sau 7.400 kg. */
const withAxles = { vehicle: { innerLengthCm: 600, axles: twoAxles(400, [2700, 4000], [2000, 7400]) } }
const noAxles = { vehicle: { innerLengthCm: 600 } }

const metrics: OptimizationResult['metrics'] = {
  totalVehicleVolumeCm3: 36_000_000,
  usedVolumeCm3: 30_000_000,
  volumeUtilizationPercent: 83.3333,
  maxPayloadKg: 5000,
  usedPayloadKg: 4200,
  payloadUtilizationPercent: 84,
  placedCount: 352,
  unplacedCount: 14,
  centerOfGravityCm: { x: 280, y: 120, z: 90 },
  frontAxleLoadKg: 3200,
  rearAxleLoadKg: 5700,
  rehandlingCount: 3,
  runtimeMs: 12,
}

const ALL: readonly HowMetric[] = ['placed', 'volume', 'payload', 'axleGap', 'rehandling', 'unplaced', 'balance']

function textOf(entries: ReturnType<typeof howEntries>): Record<string, string> {
  return Object.fromEntries(entries.map((entry) => [entry.key, entry.text]))
}

test('the facts are read from the metrics of the run and the truck of the request, nothing is recomputed', () => {
  const facts = planFacts(withAxles as never, { metrics })
  expect(facts).toMatchObject({
    total: 366, placed: 352, unplaced: 14, usedVolumeCm3: 30_000_000, bodyVolumeCm3: 36_000_000, usedKg: 4200, maxKg: 5000,
    rehandling: 3, centerXCm: 280, middleXCm: 300,
  })
  expect(facts.axles).toMatchObject({ status: 'computed', front: { loadKg: 3200, limitKg: 4000 }, rear: { loadKg: 5700, limitKg: 7400 } })
})

test('each sentence states the formula with the numbers of the run, in the order asked for', () => {
  const entries = howEntries(planFacts(withAxles as never, { metrics }), ALL, t, format)
  expect(entries.map((entry) => entry.key)).toEqual(ALL)
  expect(entries.map((entry) => entry.label).slice(0, 3)).toEqual(['Xếp được', 'Lấp đầy thể tích', 'Tải trọng đã dùng'])
  expect(textOf(entries)).toEqual({
    placed: 'Đếm kiện có chỗ trong thùng: 352 trên 366 kiện của lần chạy.',
    volume: 'Tổng thể tích 352 kiện đã xếp (30,0 m³) ÷ thể tích lòng thùng (36,0 m³) = 83,3%.',
    payload: 'Tổng khối lượng 352 kiện đã xếp (4.200 kg) ÷ tải trọng xe (5.000 kg) = 84,0%.',
    // 3.200 ÷ 4.000 = 80 %; 5.700 ÷ 7.400 = 77,03 %; chênh 2,97 điểm
    axleGap: 'Mức dùng của mỗi nhóm trục = tải ÷ giới hạn. Trước: 3.200 kg ÷ 4.000 kg = 80,0%. Sau: 5.700 kg ÷ 7.400 kg = 77,0%. Chênh nhau 3,0 điểm %.',
    rehandling: 'Sàn thùng chia thành vùng theo điểm giao, điểm giao đầu sát cửa. Kiện có tâm nằm trong vùng của điểm khác tính một lần dỡ-xếp lại: 3 trên 352 kiện đã xếp.',
    unplaced: '366 kiện của lần chạy − 352 kiện đã xếp = 14.',
    balance: 'Trọng tâm hàng cách vách trước 280 cm; giữa chiều dài thùng là 300 cm. Lệch nhau 20 cm.',
  })
})

test('a figure the plan does not have gets no sentence: no axles, no zones, nothing loaded', () => {
  const bare: OptimizationResult['metrics'] = {
    ...metrics, placedCount: 0, unplacedCount: 366, centerOfGravityCm: undefined, frontAxleLoadKg: undefined, rearAxleLoadKg: undefined, rehandlingCount: undefined,
  }
  const entries = howEntries(planFacts(noAxles as never, { metrics: bare }), ALL, t, format)
  expect(entries.map((entry) => entry.key)).toEqual(['placed', 'volume', 'payload', 'unplaced'])
})

test('no sentence names an algorithm, AI or a mock', () => {
  const entries = howEntries(planFacts(withAxles as never, { metrics }), ALL, t, format)
  for (const entry of entries) expect(`${entry.label} ${entry.text}`).not.toMatch(/mock|\bAI\b|DBLF|thuật toán/i)
})
