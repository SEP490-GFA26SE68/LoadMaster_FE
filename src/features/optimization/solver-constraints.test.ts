import { expect, test } from 'vitest'
import { createTranslator, loadLocale } from '@/lib/i18n'
import { SOLVER_CONSTRAINT_CODES, solverConstraintMessage, uniqueSolverConstraints } from './solver-constraints'

test('gộp mã ràng buộc, bỏ trùng và chuỗi trống', () => {
  expect(uniqueSolverConstraints([
    { unplaced: [
      { violatedConstraints: ['AXLE_CONFIG_MISSING', ''] },
      { violatedConstraints: ['AXLE_CONFIG_MISSING', 'PACKAGE_CANNOT_PASS_DOOR'] },
    ] },
    { unplaced: [{ violatedConstraints: ['  NO_FEASIBLE_SPACE  '] }] },
  ])).toEqual(['AXLE_CONFIG_MISSING', 'PACKAGE_CANNOT_PASS_DOOR', 'NO_FEASIBLE_SPACE'])
})

test('câu tiếng Việt nói thiếu thông số trục, không nói chung CONSTRAINT_VIOLATED', () => {
  const t = createTranslator('vi')
  expect(solverConstraintMessage('AXLE_CONFIG_MISSING', t)).toMatch(/sáu số/)
  expect(solverConstraintMessage('AXLE_CONFIG_MISSING', t)).not.toMatch(/CONSTRAINT_VIOLATED/)
  expect(solverConstraintMessage('MÃ_LẠ', t)).toContain('MÃ_LẠ')
})

test('mọi mã đã biết có câu riêng ở cả hai ngôn ngữ, kể cả mã của luật vật lý mới — không lộ mã thô', async () => {
  await loadLocale('en')
  for (const locale of ['vi', 'en'] as const) {
    const t = createTranslator(locale)
    for (const code of SOLVER_CONSTRAINT_CODES) {
      const message = solverConstraintMessage(code, t)
      expect(message).not.toContain(code)
      expect(message).not.toContain('serverPlans.')
    }
  }
  const t = createTranslator('vi')
  expect(solverConstraintMessage('STACK_PRESSURE_EXCEEDED', t)).toMatch(/sức chịu nén mặt trên/)
  expect(solverConstraintMessage('FLOOR_LOAD_EXCEEDED', t)).toMatch(/tải trọng sàn/)
  expect(solverConstraintMessage('MUST_LOAD_UNPLACED', t)).toMatch(/bắt buộc xếp/)
})
