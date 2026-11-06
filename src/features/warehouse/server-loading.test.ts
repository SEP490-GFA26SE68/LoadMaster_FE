import { expect, test } from 'vitest'
import { serverLoadingView } from './server-loading'
import type { ServerLoadingSession, ServerPlacement } from './warehouse-server-api'

const placement = (id: string, sequence: number): ServerPlacement => ({
  id, packageId: null, name: id, barcode: null, packageCode: null, qrToken: null, x: 0, y: 0, z: 0, lengthCm: 1, widthCm: 1, heightCm: 1, rotation: null, weightKg: null, sequence, stopSequence: null, stopName: null,
})

const session = (outcomes: ServerLoadingSession['outcomes']): ServerLoadingSession => ({
  tripId: '7', code: 'T', vehicle: '', box: null, maxPayloadKg: null, placements: [placement('a', 1), placement('b', 2), placement('c', 3)], outcomes, completed: false,
})

test('kiện kế tiếp là kiện chưa có kết quả đầu tiên theo thứ tự xếp', () => {
  const view = serverLoadingView(session({ a: 'confirmed', b: 'deviation' }))
  expect(view).toMatchObject({ total: 3, done: 2, step: 3 })
  expect(view.current?.id).toBe('c')
  expect(view.rows.map((row) => row.state)).toEqual(['confirmed', 'deviation', 'current'])
})

test('chưa xếp gì: bước 1, kiện sau là chưa xếp', () => {
  const view = serverLoadingView(session({}))
  expect(view).toMatchObject({ done: 0, step: 1 })
  expect(view.rows.map((row) => row.state)).toEqual(['current', 'pending', 'pending'])
})

test('xếp hết: không còn kiện kế tiếp', () => {
  const view = serverLoadingView(session({ a: 'confirmed', b: 'confirmed', c: 'confirmed' }))
  expect(view).toMatchObject({ done: 3, step: 3, current: undefined })
})
