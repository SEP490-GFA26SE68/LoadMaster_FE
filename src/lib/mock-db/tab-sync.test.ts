import { expect, test, vi } from 'vitest'
import { createMockDb, createMockDbParts } from './mock-db'
import { createTabSync, withTabSync, type TabChannel, type TabSync } from './tab-sync'
import type { PackageInput } from './package-model'
import type { MockDb } from './types'

/**
 * Đồng bộ kho giữa các tab (FE-BL-06): hai kho trong một tiến trình nối nhau bằng một kênh giả giống `BroadcastChannel` (giao bất đồng
 * bộ, không giao lại cho chính tab gửi, bản sao qua `structuredClone`). Kho của app dùng `getMockDb` — test không bao giờ mở kênh thật.
 */

const NOW = new Date('2026-09-14T05:00:00.000Z')
const crate: PackageInput = { lengthCm: 60, widthCm: 40, heightCm: 40, weightKg: 18, handlingClass: 'STANDARD', destination: 'KCN Hoà Khánh, Q. Liên Chiểu, Đà Nẵng' }

type Hub = { open(): TabChannel & { sent: unknown[] } }

function createHub(): Hub {
  const members = new Set<{ onmessage: TabChannel['onmessage'] }>()
  return {
    open() {
      const sent: unknown[] = []
      const self: TabChannel & { sent: unknown[] } = {
        sent,
        onmessage: null,
        postMessage(message) {
          sent.push(message)
          const copy = structuredClone(message)
          for (const member of members) if (member !== self) setTimeout(() => member.onmessage?.({ data: copy } as MessageEvent), 0)
        },
        close() {
          members.delete(self)
        },
      }
      members.add(self)
      return self
    },
  }
}

type Tab = { db: MockDb; sync: TabSync; channel: ReturnType<Hub['open']>; parts: ReturnType<typeof createMockDbParts> }

function openTab(hub: Hub, id: string, born: number, extra: { speed?: number; now?: () => Date; notifyDelayMs?: number } = {}): Tab {
  const parts = createMockDbParts({ now: extra.now ?? (() => NOW), ...(extra.speed === undefined ? {} : { speed: extra.speed }) })
  const channel = hub.open()
  const sync = createTabSync({ ...parts, channel, tabId: id, born, ackTimeoutMs: 40, flushDelayMs: 2, notifyDelayMs: extra.notifyDelayMs ?? 2 })
  return { db: withTabSync(parts.db, sync), sync, channel, parts }
}

const settle = (ms = 60) => new Promise((resolve) => setTimeout(resolve, ms))

/** Hai tab đã làm quen xong: `a` mở trước, `b` lấy trạng thái của `a`. */
async function pair(notifyDelayMs?: number) {
  const hub = createHub()
  const a = openTab(hub, 'a', 1)
  await a.sync.ready
  const b = openTab(hub, 'b', 2, { ...(notifyDelayMs === undefined ? {} : { notifyDelayMs }) })
  await b.sync.ready
  return { hub, a, b }
}

test('one tab alone behaves exactly as before: same ids and order, and nothing but the greeting is sent', async () => {
  const plain = createMockDb({ now: () => NOW })
  const hub = createHub()
  const solo = openTab(hub, 'solo', 1)
  await solo.sync.ready

  const [plainPackage, soloPackage] = await Promise.all([plain.createPackage(crate), solo.db.createPackage(crate)])
  await settle()
  expect(soloPackage.id).toBe(plainPackage.id)
  expect((await solo.db.listPackages()).map((pkg) => pkg.id)).toStrictEqual((await plain.listPackages()).map((pkg) => pkg.id))
  expect((await solo.db.listTrips()).map((trip) => trip.id)).toStrictEqual((await plain.listTrips()).map((trip) => trip.id))
  expect(solo.channel.sent).toStrictEqual([expect.objectContaining({ t: 'hello' })])
})

test('a write in one tab shows up in the other, together with the audit event it logged', async () => {
  const { a, b } = await pair()
  a.parts.db.restoreSession('US-0001')
  const created = await a.db.createPackage(crate)
  await settle()

  expect((await b.db.listPackages()).map((pkg) => pkg.id)).toContain(created.id)
  expect((await b.db.getPackage(created.id)).qrToken).toBe(created.qrToken)
  expect((await b.db.listEvents({ targetId: created.id })).map((event) => event.action)).toStrictEqual(['package.created'])
  // Bản ghi nhận về không dùng chung object với tab gửi
  const fromB = await b.db.updatePackage(created.id, { weightKg: 19 })
  await settle()
  expect((await a.db.getPackage(created.id)).weightKg).toBe(19)
  expect(fromB.weightKg).toBe(19)
})

test('an update made in place (a support reply pushed onto the ticket) is detected and sent', async () => {
  const { a, b } = await pair()
  a.parts.db.restoreSession('US-0001')
  const [ticket] = await a.db.listSupportTickets()
  expect(ticket).toBeDefined()
  await a.db.replyToSupportTicket(ticket!.id, 'Đã nhận, đang kiểm tra')
  await settle()

  b.parts.db.restoreSession('US-0001')
  expect((await b.db.getSupportTicket(ticket!.id)).replies.map((reply) => reply.text)).toContain('Đã nhận, đang kiểm tra')
})

test('sessions are never shared: signing in or out in one tab leaves the other signed in as someone else', async () => {
  const { a, b } = await pair()
  await a.db.authenticate('dieuphoi@loadmaster.vn', 'loadmaster')
  await b.db.authenticate('kho@loadmaster.vn', 'loadmaster')
  await settle()
  expect(a.db.sessionUser()?.role).toBe('dispatcher')
  expect(b.db.sessionUser()?.role).toBe('warehouse')

  await a.db.signOut()
  await settle()
  expect(a.db.sessionUser()).toBeNull()
  expect(b.db.sessionUser()?.role).toBe('warehouse')
  // Mỗi tab ghi nhật ký đúng người làm của mình
  const actors = (await b.db.listEvents()).filter((event) => event.action === 'auth.signedIn').map((event) => event.actorId)
  expect(new Set(actors).size).toBeGreaterThanOrEqual(2)
})

test('a tab opened later starts from the state of the open tabs, including their clock, and does not rebuild its own seed', async () => {
  const hub = createHub()
  // Tab đầu chạy nhanh 60 lần; giờ máy của tab sau chậm hơn một chút: nó phải lấy giờ của kho đang chạy
  let wall = NOW.getTime()
  const a = openTab(hub, 'a', 1, { speed: 60, now: () => new Date(wall) })
  await a.sync.ready
  a.parts.db.restoreSession('US-0001')
  const created = await a.db.createPackage(crate)
  wall += 60_000
  await settle(10)

  const b = openTab(hub, 'b', 2, { now: () => new Date(wall) })
  await b.sync.ready
  expect((await b.db.getPackage(created.id)).id).toBe(created.id)
  expect(b.parts.clock.speed()).toBe(60)
  expect(b.parts.clock.now().getTime()).toBe(a.parts.clock.now().getTime())
  // Mốc giờ của seed là của tab đầu (đã dời theo giờ của nó), không dựng lại theo giờ của tab sau
  b.parts.db.restoreSession('US-0001')
  expect(await b.db.listEvents()).toStrictEqual(await a.db.listEvents())
  expect(await b.db.listTrips()).toStrictEqual(await a.db.listTrips())
  // Tab sau ghi thì tab đầu thấy
  const second = await b.db.createPackage({ ...crate, packageCode: 'TAB-B' })
  await settle()
  expect((await a.db.getPackage(second.id)).packageCode).toBe('TAB-B')
})

test('two tabs writing at the same moment end up with the same state; the later stamp wins and nothing is left diverged', async () => {
  const { a, b } = await pair()
  a.parts.db.restoreSession('US-0001')
  b.parts.db.restoreSession('US-0001')
  const base = await a.db.createPackage(crate)
  await settle()

  // Cùng một bản ghi, cùng lúc, hai giá trị; và cùng tạo kiện mới nên trùng cả mã
  await Promise.all([a.db.updatePackage(base.id, { weightKg: 21 }), b.db.updatePackage(base.id, { weightKg: 22 })])
  await Promise.all([a.db.createPackage({ ...crate, packageCode: 'A' }), b.db.createPackage({ ...crate, packageCode: 'B' })])
  await settle(150)

  const [onA, onB] = await Promise.all([a.db.listPackages(), b.db.listPackages()])
  expect(onB).toStrictEqual(onA)
  expect(onA.find((pkg) => pkg.id === base.id)?.weightKg).toBeOneOf([21, 22])
  expect(await b.db.listEvents()).toStrictEqual(await a.db.listEvents())
  // Chạm lần nữa không làm trạng thái lệch ra
  await a.db.updatePackage(base.id, { weightKg: 30 })
  await settle()
  expect((await b.db.getPackage(base.id)).weightKg).toBe(30)
})

test('a channel that cannot carry the data turns the sync off without throwing; the store keeps working', async () => {
  const hub = createHub()
  const a = openTab(hub, 'a', 1)
  await a.sync.ready
  const b = openTab(hub, 'b', 2)
  await b.sync.ready
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  a.channel.postMessage = () => {
    throw new DOMException('function could not be cloned', 'DataCloneError')
  }
  a.parts.db.restoreSession('US-0001')
  await expect(a.db.createPackage(crate)).resolves.toBeDefined()
  await settle()
  expect(warn).toHaveBeenCalledTimes(1)
  await expect(a.db.createPackage({ ...crate, packageCode: 'AFTER' })).resolves.toBeDefined()
  warn.mockRestore()
})

test('remote changes are announced once, coalesced, so the screens can refresh', async () => {
  const { a, b } = await pair(80)
  const listener = vi.fn()
  b.sync.onRemoteChange(listener)
  a.parts.db.restoreSession('US-0001')
  await a.db.createPackage(crate)
  await a.db.createPackage({ ...crate, packageCode: 'X2' })
  await settle(200)
  expect(listener).toHaveBeenCalledTimes(1)
  // Đọc thuần không gửi gì và không làm tab kia làm mới
  listener.mockClear()
  await a.db.listPackages()
  await settle(200)
  expect(listener).not.toHaveBeenCalled()
})

test('every field of the store state is either a Map the sync can carry, the audit array, or the session that is never shared', () => {
  const { state } = createMockDbParts({ now: () => NOW })
  const kinds = Object.fromEntries(Object.entries(state).map(([name, value]) => [name, value instanceof Map ? 'map' : Array.isArray(value) ? 'array' : 'other']))
  const odd = Object.entries(kinds).filter(([name, kind]) => kind !== 'map' && !(name === 'events' && kind === 'array') && name !== 'session')
  expect(odd).toStrictEqual([])
  // Dữ liệu nhân bản được nguyên vẹn (Map, mảng lồng nhau, số vô cực)
  expect(() => structuredClone(state)).not.toThrow()
})
