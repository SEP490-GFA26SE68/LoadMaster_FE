import { expect, test } from 'vitest'
import { tierBesideName } from './plan-tier'

test('the tier tag is dropped when the plan name already says it, whatever the case', () => {
  expect(tierBesideName('Pro', 'Pro')).toBeNull()
  expect(tierBesideName('PRO ', 'Pro')).toBeNull()
  expect(tierBesideName('basic', 'Basic')).toBeNull()
  expect(tierBesideName('Gói doanh nghiệp', 'Pro')).toBe('Pro')
  expect(tierBesideName('Pro năm', 'Pro')).toBe('Pro')
})
