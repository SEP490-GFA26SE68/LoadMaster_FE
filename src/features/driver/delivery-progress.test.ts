import { expect, test } from 'vitest'
import type { DeliveryIssue, DeliveryProgress, LoadingProgress, PackageVerification, TripPhase } from '@/lib/mock-db'
import { deliveryMode, deliverySummary, deliveryView } from './delivery-progress'
import type { DeliveryItem, StopDelivery } from './driver-plan'

const item = (id: string, unloadingOrder: number): DeliveryItem => ({
  id, packageId: id.slice(0, 7), name: 'Thùng nước suối', weightKg: 12, unloadingOrder, area: 'door', layer: 'floor',
})
/** Điểm 1: ba kiện; điểm 2: hai kiện; điểm 3: không kiện nào. */
const stops: StopDelivery[] = [
  { number: 1, name: 'Bách Hoá Xanh Thủ Đức', address: '96 Võ Văn Ngân', phone: '0938 552 109', items: [item('PKG-001-01', 1), item('PKG-001-02', 2), item('PKG-001-03', 3)] },
  { number: 2, name: 'Mega Market An Phú', address: '1 Mai Chí Thọ', items: [item('PKG-002-01', 4), item('PKG-002-02', 5)] },
  { number: 3, name: 'Circle K Phú Nhuận', address: '10 Phan Xích Long', items: [] },
]
const loading = (damaged: string[] = []): LoadingProgress => ({
  revisionId: 'REV-001', startedAt: '2026-09-14T00:00:00.000Z', startedBy: null, completedAt: '2026-09-14T00:30:00.000Z', stagedIds: [],
  steps: damaged.map((packageInstanceId) => ({ packageInstanceId, outcome: 'damaged' as const, at: '2026-09-14T00:10:00.000Z' })),
})
const issue = (stopNumber: number, packageInstanceId: string, kind: DeliveryIssue['kind'], id = 'ISS-001'): DeliveryIssue => ({
  id, stopNumber, packageInstanceId, kind, note: 'Khách đổi đơn', at: '2026-09-14T02:00:00.000Z', reportedBy: 'US-0004',
})
const delivery = (overrides: Partial<DeliveryProgress> = {}): DeliveryProgress => ({
  startedAt: '2026-09-14T01:00:00.000Z', startedBy: 'US-0004',
  stops: [{ number: 1, unloadedIds: [] }, { number: 2, unloadedIds: [] }, { number: 3, unloadedIds: [] }], issues: [], ...overrides,
})
const trip = (phase: TripPhase, progress?: DeliveryProgress, damaged: string[] = []) => ({
  phase, loading: loading(damaged), ...(progress ? { delivery: progress } : {}),
})

test('mode follows the trip phase: only a delivering trip records unloading', () => {
  const modes = (['planning', 'loading', 'loaded', 'delivering'] as const).map(deliveryMode)
  expect(modes).toStrictEqual(['preview', 'preview', 'ready', 'delivering'])
})

test('before departure: stop 1 in unloading order, packages left at the warehouse as damaged are not on the list', () => {
  const view = deliveryView(trip('loaded', undefined, ['PKG-001-02']), stops)
  expect(view?.mode).toBe('ready')
  expect(view?.stop.number).toBe(1)
  expect(view?.items.map((entry) => entry.item.id)).toStrictEqual(['PKG-001-01', 'PKG-001-03'])
  expect([view?.leftAtWarehouse, view?.arrivedAt]).toStrictEqual([['PKG-001-02'], undefined])
  expect([view?.unloadedCount, view?.issueCount, view?.remaining, view?.completedStops.size]).toStrictEqual([0, 0, 2, 0])
})

test('delivering: the first stop not completed is current; an issue counts as handled, like an unloaded package', () => {
  const progress = delivery({
    stops: [
      { number: 1, unloadedIds: ['PKG-001-01', 'PKG-001-02', 'PKG-001-03'], arrivedAt: '2026-09-14T01:40:00.000Z', completedAt: '2026-09-14T02:10:00.000Z' },
      { number: 2, unloadedIds: ['PKG-002-02'], arrivedAt: '2026-09-14T02:40:00.000Z' },
      { number: 3, unloadedIds: [] },
    ],
    issues: [issue(1, 'PKG-001-02', 'damaged'), issue(2, 'PKG-002-01', 'damaged', 'ISS-002'), issue(2, 'PKG-002-01', 'refused', 'ISS-003')],
  })
  const view = deliveryView(trip('delivering', progress), stops)
  expect(view?.stop.number).toBe(2)
  // Sự cố mới nhất của PKG-002-01 là khách từ chối: kiện ở lại xe, thành Hoàn trả khi hoàn tất điểm
  expect(view?.items.map((entry) => [entry.item.id, entry.unloaded, entry.issue?.id, entry.returned])).toStrictEqual([
    ['PKG-002-01', false, 'ISS-003', true],
    ['PKG-002-02', true, undefined, false],
  ])
  // Giờ đến là của điểm đang giao; điểm chưa bấm "Đã đến" thì chưa có
  expect(view?.arrivedAt).toBe('2026-09-14T02:40:00.000Z')
  expect(deliveryView(trip('delivering', delivery()), stops)?.arrivedAt).toBeUndefined()
  // PKG-002-01 khách từ chối nên không còn gì để đối chiếu dỡ
  expect([view?.unloadedCount, view?.issueCount, view?.remaining, view?.verifiable]).toStrictEqual([1, 1, 0, 0])
  expect([...(view?.completedStops ?? [])]).toStrictEqual([1])
})

test('a stop without packages on the vehicle is current with nothing to unload', () => {
  const progress = delivery({ stops: [{ number: 1, unloadedIds: [], completedAt: 'x' }, { number: 2, unloadedIds: [], completedAt: 'y' }, { number: 3, unloadedIds: [] }] })
  const view = deliveryView(trip('delivering', progress), stops)
  expect([view?.stop.number, view?.items.length, view?.remaining]).toStrictEqual([3, 0, 0])
})

test('each item carries how it was verified; pending manual confirmations of the current stop are counted, a rejected one flags its package', () => {
  const at = '2026-09-14T02:00:00.000Z'
  const verifications: PackageVerification[] = [
    { id: 'VF-001', context: 'UNLOADING', stopNumber: 1, packageInstanceId: 'PKG-001-01', method: 'QR', at, by: 'US-0004' },
    { id: 'VF-002', context: 'UNLOADING', stopNumber: 1, packageInstanceId: 'PKG-001-02', method: 'MANUAL', at, by: 'US-0004', manual: { status: 'MANUAL_PENDING', reason: 'LABEL_DAMAGED' } },
    { id: 'VF-003', context: 'UNLOADING', stopNumber: 1, packageInstanceId: 'PKG-001-03', method: 'MANUAL', at, by: 'US-0004', manual: { status: 'MANUAL_REJECTED', reason: 'OTHER', note: 'Mờ', rejectReason: 'Đếm lại' } },
    // Xác nhận tay của bước xếp không tính vào điểm giao
    { id: 'VF-004', context: 'LOADING', packageInstanceId: 'PKG-002-01', method: 'MANUAL', at, by: 'US-0003', manual: { status: 'MANUAL_PENDING', reason: 'QR_UNREADABLE' } },
  ]
  const progress = delivery({ stops: [{ number: 1, unloadedIds: ['PKG-001-01', 'PKG-001-02'] }, { number: 2, unloadedIds: [] }, { number: 3, unloadedIds: [] }] })
  const view = deliveryView({ ...trip('delivering', progress), verifications }, stops)
  expect(view?.items.map((entry) => [entry.item.id, entry.unloaded, entry.verification?.id])).toStrictEqual([
    ['PKG-001-01', true, 'VF-001'], ['PKG-001-02', true, 'VF-002'], ['PKG-001-03', false, 'VF-003'],
  ])
  expect([view?.pendingConfirms, view?.remaining, view?.verifiable]).toStrictEqual([1, 1, 1])
  // Kiện khách từ chối sau khi đã dỡ (kho bỏ dấu đã dỡ) không còn mang cách đối chiếu cũ
  const refused = delivery({ stops: [{ number: 1, unloadedIds: ['PKG-001-02'] }, { number: 2, unloadedIds: [] }, { number: 3, unloadedIds: [] }], issues: [issue(1, 'PKG-001-01', 'refused')] })
  expect(deliveryView({ ...trip('delivering', refused), verifications }, stops)?.items.map((entry) => [entry.returned, entry.verification?.id])).toStrictEqual([
    [true, undefined], [false, 'VF-002'], [false, 'VF-003'],
  ])
})

test('summary: stops of the trip, packages unloaded at every stop, all issues and the delivery times', () => {
  const progress = delivery({
    completedAt: '2026-09-14T04:00:00.000Z',
    stops: [{ number: 1, unloadedIds: ['PKG-001-01', 'PKG-001-03'], completedAt: 'a' }, { number: 2, unloadedIds: ['PKG-002-01', 'PKG-002-02'], completedAt: 'b' }, { number: 3, unloadedIds: [], completedAt: 'c' }],
    issues: [issue(1, 'PKG-001-02', 'refused')],
  })
  const tripStops = stops.map(({ number, name, address }) => ({ id: `STOP-0${number}`, name, address }))
  expect(deliverySummary({ stops: tripStops, delivery: progress })).toStrictEqual({
    stopCount: 3, delivered: 4, issues: [issue(1, 'PKG-001-02', 'refused')], startedAt: '2026-09-14T01:00:00.000Z', completedAt: '2026-09-14T04:00:00.000Z',
  })
})
