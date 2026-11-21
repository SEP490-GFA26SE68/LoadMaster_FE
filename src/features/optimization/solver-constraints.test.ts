import { expect, test } from 'vitest'
import { createTranslator } from '@/lib/i18n'
import { solverConstraintMessage, uniqueSolverConstraints } from './solver-constraints'

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
