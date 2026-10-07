import { expect, test } from 'vitest'
import { exitAction } from './exit'

test('a warehouse worker leaving the warehouse screen signs out instead of landing on dispatcher pages', () => {
  expect(exitAction('warehouse', '/kho')).toStrictEqual({ kind: 'signOut' })
})

test('a warehouse worker leaving a loading session goes back to the trip list (LM-086)', () => {
  const session = '/kho?chuyen=TRIP-2026-0914'
  expect(exitAction('warehouse', session, '/chuyen/TRIP-2026-0914')).toStrictEqual({ kind: 'link', to: '/kho' })
})

test('a driver leaving "My trips" signs out; leaving a trip goes back to the list (LM-087)', () => {
  expect(exitAction('driver', '/tai-xe')).toStrictEqual({ kind: 'signOut' })
  expect(exitAction('driver', '/tai-xe/diem-giao', '/tai-xe')).toStrictEqual({ kind: 'link', to: '/tai-xe' })
})

test('a dispatcher returns to the trip the screen was opened from, or to the trip list', () => {
  expect(exitAction('dispatcher', '/kho', '/chuyen/TRIP-2026-0914')).toStrictEqual({ kind: 'link', to: '/chuyen/TRIP-2026-0914' })
  expect(exitAction('dispatcher', '/tai-xe/diem-giao')).toStrictEqual({ kind: 'link', to: '/chuyen' })
})

/** FE-0-04: luật hỏi quyền `trips.view`, không hỏi tên vai trò — quản lý công ty cũng xem được chuyến. */
test('a company manager, who can open trips, also returns to the trip the screen was opened from, or to the dashboard', () => {
  expect(exitAction('manager', '/kho', '/chuyen/TRIP-2026-0914')).toStrictEqual({ kind: 'link', to: '/chuyen/TRIP-2026-0914' })
  expect(exitAction('manager', '/kho')).toStrictEqual({ kind: 'link', to: '/' })
})

test('roles that cannot open trips return to their own screen', () => {
  expect(exitAction('warehouse', '/tai-xe/diem-giao')).toStrictEqual({ kind: 'link', to: '/kho' })
  expect(exitAction('driver', '/kho?chuyen=TRIP-2026-0914', '/chuyen/TRIP-2026-0914')).toStrictEqual({ kind: 'link', to: '/tai-xe' })
})

test('the four new roles never follow the trip link: they return to the screen they can open (FE-0-03)', () => {
  const session = '/kho?chuyen=TRIP-2026-0914'
  // Quản trị hệ thống và quản trị công ty không xem được chuyến: trang chuyến sẽ là 403
  expect(exitAction('systemAdmin', session, '/chuyen/TRIP-2026-0914')).toStrictEqual({ kind: 'link', to: '/nguoi-dung' })
  expect(exitAction('companyAdmin', '/tai-xe/diem-giao', '/tai-xe')).toStrictEqual({ kind: 'link', to: '/nguoi-dung' })
  expect(exitAction('systemManager', session, '/chuyen/TRIP-2026-0914')).toStrictEqual({ kind: 'link', to: '/nen-tang/goi' })
  expect(exitAction('systemSupporter', '/tai-xe/diem-giao')).toStrictEqual({ kind: 'link', to: '/ho-so' })
})
