import { expect, test } from 'vitest'
import { createTranslator } from '@/lib/i18n'
import { createTripFormSchema, tripFormDefaults } from './trip-form.schema'
import { formChecks, formIssues, stopFieldOf } from './trip-form-checks'
import { runDateHint } from './trip-dates'

const schema = createTripFormSchema(createTranslator('vi'), { withStops: true })

test('a fresh form has three empty required fields, counted as to-do until they are touched', () => {
  const issues = formIssues(schema, tripFormDefaults())
  expect(issues.map((issue) => issue.path)).toStrictEqual(['name', 'vehicleId', 'stops.0.name'])
  const checks = formChecks(issues, () => false)
  expect(checks).toMatchObject({ failCount: 0, todoCount: 3 })
  expect(checks.groups.name).toStrictEqual({ state: 'todo', issue: { path: 'name', message: 'Nhập tên chuyến' } })
})

test('an error in a touched field wins over an untouched empty one in the same group', () => {
  const values = { ...tripFormDefaults(), stops: [{ name: '', address: '', phone: '0918 407 331/332', contactName: '' }] }
  const checks = formChecks(formIssues(schema, values), (path) => path === 'stops.0.phone')
  expect(checks.groups.stops).toStrictEqual({
    state: 'fail',
    issue: { path: 'stops.0.phone', message: 'Chỉ gồm chữ số, dấu cách và + - . ( )' },
  })
  expect(checks).toMatchObject({ failCount: 1, todoCount: 3 })
})

test('a valid form passes every group', () => {
  const values = { ...tripFormDefaults(), name: 'Tuyến Thủ Đức', vehicleId: 'VEH-001', stops: [{ name: 'Thủ Đức', address: '', phone: '', contactName: '' }] }
  const checks = formChecks(formIssues(schema, values), () => true)
  expect(checks).toMatchObject({ failCount: 0, todoCount: 0 })
  expect(Object.values(checks.groups).map((group) => group.state)).toStrictEqual(['pass', 'pass', 'pass'])
})

test('stop paths are read as 1-based stop numbers', () => {
  expect(stopFieldOf('stops.1.phone')).toStrictEqual({ number: 2, field: 'phone' })
  expect(stopFieldOf('stops')).toBeNull()
  expect(stopFieldOf('name')).toBeNull()
})

test('the run-date hint names the weekday and says today / tomorrow / yesterday around today', () => {
  // 27/09/2026 là Chủ Nhật
  expect(runDateHint('2026-09-27', '2026-09-27')).toStrictEqual({ weekday: 'sun', relative: 'today' })
  expect(runDateHint('2026-09-28', '2026-09-27')).toStrictEqual({ weekday: 'mon', relative: 'tomorrow' })
  expect(runDateHint('2026-09-26', '2026-09-27')).toStrictEqual({ weekday: 'sat', relative: 'yesterday' })
  expect(runDateHint('2026-10-02', '2026-09-27')).toStrictEqual({ weekday: 'fri', relative: null })
  expect(runDateHint('', '2026-09-27')).toBeNull()
})
