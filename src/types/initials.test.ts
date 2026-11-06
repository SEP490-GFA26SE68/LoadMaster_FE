import { expect, test } from 'vitest'
import { actorInitials } from '@/features/admin/audit-look'
import { initialsOf } from './user'

test('initials skip words that do not start with a letter', () => {
  expect(initialsOf('Trần Quốc Bảo (demo)')).toBe('QB')
  expect(actorInitials('Đặng Văn Tài (demo)')).toBe('VT')
  expect(initialsOf('(demo)')).toBe('?')
})
