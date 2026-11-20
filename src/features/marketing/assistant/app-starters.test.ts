import { expect, test } from 'vitest'
import type { Role } from '@/types/user'
import { appStartersFor } from './app-starters'

/** Mỗi vai trò chỉ được gợi ý câu mà máy chủ có công cụ trả lời cho vai trò đó, tối đa bốn câu. */
test.each<[Role, string[]]>([
  ['dispatcher', ['page', 'trips', 'credit', 'tickets']],
  ['companyManager', ['page', 'trips', 'credit', 'tickets']],
  ['companyAdmin', ['page', 'credit', 'tickets', 'plans']],
  ['warehouse', ['page', 'tickets', 'plans']],
  ['driver', ['page', 'trips', 'payroll', 'tickets']],
  ['systemAdmin', ['page', 'plans']],
  ['systemManager', ['page', 'plans']],
  ['systemSupporter', ['page', 'plans']],
])('app starters of %s', (role, expected) => {
  expect(appStartersFor(role)).toStrictEqual(expected)
})
