import { expect, test } from 'vitest'
import type { PlanScore } from '@/features/optimization/load-plans-backend-api'
import { createFormatter } from '@/lib/format'
import { createTranslator } from '@/lib/i18n'
import { planScoreEntries, scoreProfileName } from './plan-score-entries'

const t = createTranslator('vi')
const format = createFormatter('vi-VN')

const SCORE: PlanScore = {
  profile: 'A',
  assumedWeights: true,
  j: 5.17,
  volume: { ratio: 0.625, weight: 0.6 },
  count: { ratio: 0.9, weight: 0.4 },
  components: [
    { code: 'S1', computed: true, value: 0.25, weight: 0.3, contribution: -7.5 },
    { code: 'S3', computed: false },
    { code: 'S5', computed: false },
    { code: 'S7', computed: false },
  ],
}

test('phân rã J: công thức, hai khoản cộng (100 × w × U), khoản trừ theo phần trừ máy chủ trả, khoản không tính kèm lý do', () => {
  expect(planScoreEntries(SCORE, t, format).map(({ label, text }) => [label, text])).toEqual([
    ['Công thức', 'J = 100 × (w_vol × U_vol + w_n × U_n − Σ wₖ × Sₖ), mỗi Sₖ chặn trong khoảng 0–1.'],
    ['Thể tích (U_vol)', 'Lấp đầy 62,5% × trọng số 0,60 → cộng 37,5 điểm.'],
    ['Số kiện (U_n)', 'Kiện xếp được 90,0% × trọng số 0,40 → cộng 36,0 điểm.'],
    ['S1 · Dỡ-xếp lại', 'Giá trị 25,0% × trọng số 0,30 → trừ 7,5 điểm.'],
    ['S3 · Mất cân bằng hai trục', 'Không tính: xe chưa khai đủ dữ liệu trục.'],
    ['S5 · Kiện cùng nhóm bị tách', 'Không tính: máy chủ không tính khoản này cho phương án này.'],
    ['S7 · Nguy cơ lật khi phanh / cua', 'Không tính: dịch vụ tối ưu chưa tính khoản này.'],
  ])
})

test('khoản cộng máy chủ không trả thì không có dòng', () => {
  const entries = planScoreEntries({ ...SCORE, volume: null, count: null, components: [] }, t, format)
  expect(entries.map((entry) => entry.key)).toEqual(['formula'])
})

test('tên hồ sơ theo mã; mã lạ hiện nguyên mã', () => {
  expect(['default', 'A', 'B', 'C', 'X9'].map((profile) => scoreProfileName(profile, t))).toEqual(['Mặc định', 'Chở nhiều', 'An toàn tải', 'Dỡ nhanh', 'X9'])
})
