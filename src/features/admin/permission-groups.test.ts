import { expect, test } from 'vitest'
import { PERMISSIONS } from '@/features/auth/permissions'
import { PERMISSION_GROUP_IDS, PERMISSION_GROUPS } from './permission-groups'

test('mỗi quyền thuộc đúng một nhóm, mỗi khu vực một nhóm, ghép lại ra đúng thứ tự của PERMISSIONS', () => {
  expect(PERMISSION_GROUPS.flatMap((group) => group.permissions)).toStrictEqual([...PERMISSIONS])
  // Khu vực không lặp: mọi tiền tố cùng khu vực đứng liền nhau
  expect(PERMISSION_GROUPS.map((group) => group.id)).toStrictEqual([...PERMISSION_GROUP_IDS])
  expect(PERMISSION_GROUPS.every((group) => group.permissions.length > 0)).toBe(true)
})

test('the existing company warehouse permission has a real group at its catalog position', () => {
  expect(PERMISSION_GROUPS.find(group => group.id === 'companyWarehouses')).toStrictEqual({ id: 'companyWarehouses', permissions: ['companyWarehouses.manage'] })
  expect(PERMISSION_GROUPS.every((group) => PERMISSION_GROUP_IDS.includes(group.id))).toBe(true)
})
