import { expect, test } from 'vitest'
import { createTranslator } from '@/lib/i18n'
import { createTripFormSchema, departureAtOf, depotOf, tripFormDefaults } from './trip-form.schema'
import { formChecks, formIssues, stopFieldOf } from './trip-form-checks'
import { runDateHint } from './trip-dates'

const schema = createTripFormSchema(createTranslator('vi'))

/** Kho của Long Bình (`seed-depots.ts`): kho xuất phát mặc định của chuyến mới. */
const DEPOT = { name: 'Kho Long Bình', address: '9 Đường 3A, KCN Biên Hoà 2, Biên Hoà, Đồng Nai', lat: 10.9294, lng: 106.8747 }
const STOP = { name: 'Thủ Đức', address: '', phone: '', contactName: '' }

test('a fresh form has two empty required fields, counted as to-do until they are touched; the depot of the company is filled in', () => {
  const values = tripFormDefaults(undefined, DEPOT)
  expect(values).toMatchObject({ departureTime: '08:00', stops: [], depot: { name: 'Kho Long Bình', coordinates: { lat: '10.9294', lng: '106.8747' } } })
  const issues = formIssues(schema, values)
  expect(issues.map((issue) => issue.path)).toStrictEqual(['name', 'vehicleId'])
  const checks = formChecks(issues, () => false)
  expect(checks).toMatchObject({ failCount: 0, todoCount: 2 })
  expect(checks.groups.name).toStrictEqual({ state: 'todo', issue: { path: 'name', message: 'Nhập tên chuyến' } })
  expect(checks.groups.depot).toStrictEqual({ state: 'pass', issue: null })
})

test('the departure depot needs a name and coordinates; the departure time belongs to the name group', () => {
  // Kho của công ty chưa tải xong: tên và toạ độ còn trống
  expect(formIssues(schema, tripFormDefaults()).map((issue) => [issue.path, issue.message])).toStrictEqual([
    ['name', 'Nhập tên chuyến'], ['vehicleId', 'Chọn xe'], ['depot.name', 'Nhập tên kho xuất phát'], ['depot.coordinates', 'Chọn toạ độ kho xuất phát'],
  ])
  const values = { ...tripFormDefaults(undefined, DEPOT), name: 'Tuyến Thủ Đức', vehicleId: 'VEH-001' }
  const invalid = { ...values, departureTime: '', depot: { ...values.depot, coordinates: { lat: '91', lng: '106.8747' } } }
  const checks = formChecks(formIssues(schema, invalid), () => true)
  expect(checks.groups.name).toStrictEqual({ state: 'fail', issue: { path: 'departureTime', message: 'Chọn giờ xuất phát' } })
  expect(checks.groups.depot).toStrictEqual({ state: 'fail', issue: { path: 'depot.coordinates', message: 'Toạ độ kho chưa hợp lệ' } })
  expect(checks).toMatchObject({ failCount: 2, todoCount: 0 })
})

test('an error in a touched field wins over an untouched empty one in the same group', () => {
  // Form sửa: điểm giao đang có sửa được chữ — tên bỏ trống chưa chạm, số điện thoại sai đã chạm
  const values = { ...tripFormDefaults(undefined, DEPOT), stops: [{ name: '', address: '', phone: '0918 407 331/332', contactName: '' }] }
  const checks = formChecks(formIssues(schema, values), (path) => path === 'stops.0.phone')
  expect(checks.groups.stops).toStrictEqual({
    state: 'fail',
    issue: { path: 'stops.0.phone', message: 'Chỉ gồm chữ số, dấu cách và + - . ( )' },
  })
  expect(checks).toMatchObject({ failCount: 1, todoCount: 3 })
})

test('a valid form passes every group', () => {
  const values = { ...tripFormDefaults(undefined, DEPOT), name: 'Tuyến Thủ Đức', vehicleId: 'VEH-001', stops: [STOP] }
  const checks = formChecks(formIssues(schema, values), () => true)
  expect(checks).toMatchObject({ failCount: 0, todoCount: 0 })
  expect(Object.values(checks.groups).map((group) => group.state)).toStrictEqual(['pass', 'pass', 'pass', 'pass'])
})

test('the form sends the departure as Vietnam time and the depot as numbers', () => {
  const values = { ...tripFormDefaults(undefined, DEPOT), scheduledDate: '2026-09-21', departureTime: '06:30' }
  expect(departureAtOf(values)).toBe('2026-09-20T23:30:00.000Z')
  expect(depotOf({ name: ' Bãi xe Tân Vạn ', address: ' QL1A ', coordinates: { lat: '10,9', lng: '106.82' } })).toStrictEqual({ name: 'Bãi xe Tân Vạn', address: 'QL1A', lat: 10.9, lng: 106.82 })
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
