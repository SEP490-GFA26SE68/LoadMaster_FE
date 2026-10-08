import type { SimClock } from './clock'
import type { DbState } from './db-context'
import type { MockDb } from './types'

/**
 * Đồng bộ kho giữa các tab cùng trình duyệt (FE-BL-06, D-95). Kho nằm trong bộ nhớ từng tab nên điều phối và tài xế không thấy nhau
 * ở hai tab cạnh nhau; lớp này chuyển thay đổi của kho sang các tab khác qua kênh `BroadcastChannel`. Nó **không thay backend**: chỉ
 * các tab cùng nguồn gốc (origin) trong cùng trình duyệt thấy nhau, máy khác hay trình duyệt khác vẫn không thấy gì, và **không lưu
 * bền gì** (D-41) — đóng hoặc tải lại mọi tab là dữ liệu về seed.
 *
 * Lớp này đứng ngoài kho: `db-*.ts` không biết có nó. Nó đọc `DbState` và đồng hồ của kho (`createMockDbParts`), được gọi sau mỗi lượt
 * đọc/ghi (`afterOperation`) và là bản duy nhất trong ứng dụng (`app-db.ts`) — mỗi `createMockDb()` của test là một kho riêng.
 *
 * - **Cái gì được gửi**: thay đổi theo từng bản ghi (`delta`), tìm bằng cách so từng bản ghi với bản đã gửi lần trước — kho ghi tại chỗ
 *   (`ticket.replies.push`, `payment.status = …`) và đọc cũng ghi (đồng hồ, vị trí xe), nên không có chỗ nào để biết "bản ghi nào vừa
 *   đổi" ngoài việc so. `packages` và `revisions` chỉ ghi bằng cách thay cả bản ghi (`put`), `events` chỉ thêm: ba bảng này so theo
 *   danh tính object cho rẻ. Phiên (`session`) **không bao giờ** được đồng bộ: hai tab = hai người dùng khác nhau.
 * - **Tab mở sau** hỏi các tab đang mở (`hello`): tab trả lời đầu tiên gửi nguyên trạng thái (`snapshot`) kèm đồng hồ của nó; không ai
 *   trả lời trong `ackTimeoutMs` thì tab dùng seed như khi chỉ có một tab. Tab chưa có bạn không so, không gửi gì cả.
 * - **Hai tab ghi cùng lúc**: mỗi bản ghi mang dấu Lamport `(bộ đếm, mã tab)`, bản mới hơn thắng ở mọi tab — các tab hội tụ về cùng
 *   một trạng thái; bản ghi thua bị mất (ví dụ hai sự kiện nhật ký cùng mã).
 * - **Đồng hồ**: các tab dùng chung đồng hồ của tab đầu tiên (`?toc-do` của tab sau bị bỏ qua); tab mở sau nhận giờ và tốc độ từ
 *   snapshot, đổi tốc độ giữa chừng (GPS thật) đi kèm trong `delta`. Vị trí xe là dữ liệu tính dần theo đồng hồ — cũng được đồng bộ.
 */

/** Kênh tối thiểu cần dùng: `BroadcastChannel` của trình duyệt, hoặc bản giả trong test. */
export type TabChannel = {
  postMessage(message: unknown): void
  onmessage: ((event: MessageEvent) => void) | null
  close(): void
}

export type TabSyncOptions = {
  state: DbState
  clock: SimClock
  channel: TabChannel
  /** Mã tab; mặc định ngẫu nhiên. */
  tabId?: string
  /** Lúc tab mở (ms): hai tab cùng mở một lúc thì tab mở trước trả lời tab mở sau. */
  born?: number
  /** Chờ trả lời của các tab khác trước khi coi mình là tab duy nhất. */
  ackTimeoutMs?: number
  /** Chờ nguyên trạng thái từ tab đã trả lời. */
  snapshotTimeoutMs?: number
  /** Gộp các lượt ghi sát nhau thành một lần gửi. */
  flushDelayMs?: number
  /** Gộp các lần nhận thay đổi thành một thông báo làm mới màn hình. */
  notifyDelayMs?: number
}

export type TabSync = {
  /** Gọi sau mỗi lượt đọc/ghi của kho (kể cả bị từ chối): nếu có tab khác thì gửi phần đã đổi. */
  afterOperation(): void
  /** Gọi mỗi khi trạng thái kho được thay bằng dữ liệu của tab khác (đã gộp, trễ `notifyDelayMs`). Trả hàm huỷ đăng ký. */
  onRemoteChange(listener: () => void): () => void
  /** Xong bước làm quen: đã nhận trạng thái của tab đang mở, hoặc đã coi mình là tab duy nhất. */
  ready: Promise<void>
  close(): void
}

type Clock = { simMs: number; speed: number }
type Change = { set: [string, unknown][]; del: string[] }
type Changes = Record<string, Change>

type Message =
  | { v: 1; t: 'hello'; from: string; born: number }
  | { v: 1; t: 'ack'; from: string; to: string }
  | { v: 1; t: 'want'; from: string; to: string }
  | { v: 1; t: 'snapshot'; from: string; to: string; tables: Record<string, Map<string, unknown>>; stamps: [string, number, string][]; counter: number; clock: Clock }
  | { v: 1; t: 'delta'; from: string; c: number; changes: Changes; clock?: Clock }

type Delta = Extract<Message, { t: 'delta' }>
type Snapshot = Extract<Message, { t: 'snapshot' }>

/** Bảng chỉ ghi bằng cách thay cả bản ghi hoặc thêm bản ghi mới: so theo danh tính object, không cần so nội dung. */
const REPLACE_ONLY = new Set(['packages', 'revisions', 'events'])

type Table = {
  replaceOnly: boolean
  entries(): Iterable<[string, unknown]>
  set(key: string, value: unknown): void
  delete(key: string): void
  clear(): void
  /** Sau một lô thay đổi. */
  settle(): void
}

function tablesOf(state: DbState): Map<string, Table> {
  const tables = new Map<string, Table>()
  for (const [name, value] of Object.entries(state)) {
    if (name === 'session') continue
    if (value instanceof Map) {
      const map = value as Map<string, unknown>
      tables.set(name, {
        replaceOnly: REPLACE_ONLY.has(name),
        entries: () => map.entries(),
        set: (key, record) => void map.set(key, record),
        delete: (key) => void map.delete(key),
        clear: () => map.clear(),
        settle: () => {},
      })
    } else if (name === 'events' && Array.isArray(value)) {
      const events = value as { id: string }[]
      tables.set(name, {
        replaceOnly: true,
        entries: function* () {
          for (const event of events) yield [event.id, event] as [string, unknown]
        },
        set: (key, record) => {
          const index = events.findIndex((event) => event.id === key)
          if (index >= 0) events[index] = record as { id: string }
          else events.push(record as { id: string })
        },
        delete: (key) => {
          const index = events.findIndex((event) => event.id === key)
          if (index >= 0) events.splice(index, 1)
        },
        clear: () => void (events.length = 0),
        // Nhật ký cũ trước, theo mã tăng dần
        settle: () => {
          if (events.some((event, index) => index > 0 && events[index - 1]!.id > event.id)) events.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
        },
      })
    }
  }
  return tables
}

type Entry = { ref: unknown; json: string | null }
type Shadow = Map<string, Map<string, Entry>>
type Stamp = { c: number; t: string }

const KEY_SEPARATOR = '\u0001'

function isNewer(next: Stamp, current: Stamp | undefined): boolean {
  if (current === undefined) return true
  return next.c !== current.c ? next.c > current.c : next.t > current.t
}

export function createTabSync(options: TabSyncOptions): TabSync {
  const { state, clock, channel } = options
  const tabId = options.tabId ?? Math.random().toString(36).slice(2, 10)
  const born = options.born ?? Date.now()
  const ackTimeoutMs = options.ackTimeoutMs ?? 250
  const snapshotTimeoutMs = options.snapshotTimeoutMs ?? 8000
  const flushDelayMs = options.flushDelayMs ?? 20
  const notifyDelayMs = options.notifyDelayMs ?? 100

  const tables = tablesOf(state)
  const stamps = new Map<string, Stamp>()
  const listeners = new Set<() => void>()
  let shadow: Shadow | null = null
  let counter = 0
  let hasPeers = false
  let broken = false
  let phase: 'joining' | 'waiting' | 'ready' = 'joining'
  let sentSpeed = clock.speed()
  let buffered: Delta[] = []
  let flushTimer: ReturnType<typeof setTimeout> | undefined
  let notifyTimer: ReturnType<typeof setTimeout> | undefined
  let phaseTimer: ReturnType<typeof setTimeout> | undefined
  let markReady: () => void = () => {}
  const ready = new Promise<void>((resolve) => {
    markReady = resolve
  })

  const clockNow = (): Clock => ({ simMs: clock.now().getTime(), speed: clock.speed() })

  function send(message: Message) {
    if (broken) return
    try {
      channel.postMessage(message)
    } catch (error) {
      // Dữ liệu không nhân bản được (hàm, class…): thôi đồng bộ, kho của tab vẫn chạy như một tab duy nhất
      broken = true
      hasPeers = false
      console.warn('Mock store tab sync turned off:', error)
    }
  }

  // --- So sánh với bản đã gửi ---

  function buildShadow(): Shadow {
    const built: Shadow = new Map()
    for (const [name, table] of tables) {
      const entries = new Map<string, Entry>()
      for (const [key, record] of table.entries()) entries.set(key, { ref: record, json: table.replaceOnly ? null : JSON.stringify(record) })
      built.set(name, entries)
    }
    return built
  }

  /** Thay đổi của kho kể từ lần gửi/nhận trước; cập nhật luôn bản đã gửi. */
  function diff(): Changes {
    shadow ??= buildShadow()
    const changes: Changes = {}
    for (const [name, table] of tables) {
      const known = shadow.get(name)!
      const change: Change = { set: [], del: [] }
      const present = new Set<string>()
      for (const [key, record] of table.entries()) {
        present.add(key)
        const entry = known.get(key)
        if (table.replaceOnly) {
          if (entry?.ref === record) continue
          known.set(key, { ref: record, json: null })
        } else {
          const json = JSON.stringify(record)
          if (entry?.json === json) continue
          known.set(key, { ref: record, json })
        }
        change.set.push([key, record])
      }
      for (const key of known.keys()) {
        if (present.has(key)) continue
        known.delete(key)
        change.del.push(key)
      }
      if (change.set.length > 0 || change.del.length > 0) changes[name] = change
    }
    return changes
  }

  function flush() {
    flushTimer = undefined
    if (!hasPeers || phase !== 'ready') return
    const changes = diff()
    const clockChanged = clock.speed() !== sentSpeed
    if (Object.keys(changes).length === 0 && !clockChanged) return
    counter += 1
    const stamp: Stamp = { c: counter, t: tabId }
    for (const [name, change] of Object.entries(changes)) {
      for (const [key] of change.set) stamps.set(name + KEY_SEPARATOR + key, stamp)
      for (const key of change.del) stamps.set(name + KEY_SEPARATOR + key, stamp)
    }
    const message: Delta = { v: 1, t: 'delta', from: tabId, c: counter, changes }
    if (clockChanged) {
      message.clock = clockNow()
      sentSpeed = message.clock.speed
    }
    send(message)
  }

  // --- Nhận ---

  function notify() {
    if (notifyTimer !== undefined) return
    notifyTimer = setTimeout(() => {
      notifyTimer = undefined
      for (const listener of listeners) listener()
    }, notifyDelayMs)
  }

  function applyDelta(delta: Delta) {
    counter = Math.max(counter, delta.c)
    const stamp: Stamp = { c: delta.c, t: delta.from }
    shadow ??= buildShadow()
    let changed = false
    for (const [name, change] of Object.entries(delta.changes)) {
      const table = tables.get(name)
      const known = shadow.get(name)
      if (table === undefined || known === undefined) continue
      for (const [key, record] of change.set) {
        const stampKey = name + KEY_SEPARATOR + key
        if (!isNewer(stamp, stamps.get(stampKey))) continue
        stamps.set(stampKey, stamp)
        const json = table.replaceOnly ? null : JSON.stringify(record)
        if (json === null || known.get(key)?.json !== json) changed = true // bảng chỉ-thay-thế: bản ghi nhận được luôn là bản mới
        table.set(key, record)
        known.set(key, { ref: record, json })
      }
      for (const key of change.del) {
        const stampKey = name + KEY_SEPARATOR + key
        if (!isNewer(stamp, stamps.get(stampKey))) continue
        stamps.set(stampKey, stamp)
        if (known.has(key)) changed = true
        table.delete(key)
        known.delete(key)
      }
      table.settle()
    }
    if (delta.clock !== undefined) adoptClock(delta.clock)
    if (changed) notify()
  }

  function adoptClock(next: Clock) {
    // `simMs` là giờ của kho lúc bên kia gửi; nhận gần như tức thời trong cùng máy
    clock.adopt(next.simMs, next.speed)
    sentSpeed = next.speed
  }

  function applySnapshot(snapshot: Snapshot) {
    for (const [name, table] of tables) {
      const incoming = snapshot.tables[name]
      if (incoming === undefined) continue
      table.clear()
      for (const [key, record] of incoming) table.set(key, record)
      table.settle()
    }
    stamps.clear()
    for (const [key, c, t] of snapshot.stamps) stamps.set(key, { c, t })
    counter = Math.max(counter, snapshot.counter)
    adoptClock(snapshot.clock)
    shadow = buildShadow()
  }

  function becomeReady() {
    clearTimeout(phaseTimer)
    phase = 'ready'
    if (hasPeers) shadow ??= buildShadow()
    const pending = buffered
    buffered = []
    for (const delta of pending) applyDelta(delta)
    markReady()
  }

  function onMessage(data: unknown) {
    if (typeof data !== 'object' || data === null) return
    const message = data as Message
    if (message.v !== 1 || message.from === tabId) return
    hasPeers = true
    switch (message.t) {
      case 'hello': {
        // Tab đang mở trả lời; hai tab cùng mở một lúc thì tab mở trước trả lời tab mở sau
        const older = born < message.born || (born === message.born && tabId < message.from)
        if (phase === 'ready' || older) {
          shadow ??= buildShadow()
          send({ v: 1, t: 'ack', from: tabId, to: message.from })
        }
        return
      }
      case 'ack':
        if (message.to !== tabId || phase !== 'joining') return
        phase = 'waiting'
        clearTimeout(phaseTimer)
        phaseTimer = setTimeout(becomeReady, snapshotTimeoutMs)
        send({ v: 1, t: 'want', from: tabId, to: message.from })
        return
      case 'want': {
        if (message.to !== tabId) return
        shadow ??= buildShadow()
        const snapshotTables: Record<string, Map<string, unknown>> = {}
        for (const [name, table] of tables) snapshotTables[name] = new Map(table.entries())
        send({
          v: 1,
          t: 'snapshot',
          from: tabId,
          to: message.from,
          tables: snapshotTables,
          stamps: [...stamps].map(([key, stamp]) => [key, stamp.c, stamp.t]),
          counter,
          clock: clockNow(),
        })
        return
      }
      case 'snapshot':
        if (message.to !== tabId || phase !== 'waiting') return
        applySnapshot(message)
        becomeReady()
        notify()
        return
      case 'delta':
        if (phase !== 'ready') {
          buffered.push(message)
          return
        }
        // Ghi của tab này chưa gửi thì gửi trước, để dấu của nó đứng trước bản vừa nhận
        flush()
        applyDelta(message)
        return
    }
  }

  channel.onmessage = (event) => onMessage(event.data)
  send({ v: 1, t: 'hello', from: tabId, born })
  phaseTimer = setTimeout(() => {
    if (phase === 'joining') becomeReady()
  }, ackTimeoutMs)

  return {
    afterOperation() {
      if (!hasPeers || phase !== 'ready' || flushTimer !== undefined) return
      flushTimer = setTimeout(flush, flushDelayMs)
    },
    onRemoteChange(listener) {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
    ready,
    close() {
      clearTimeout(flushTimer)
      clearTimeout(notifyTimer)
      clearTimeout(phaseTimer)
      channel.onmessage = null
      channel.close()
    },
  }
}

/** Báo cho lớp đồng bộ mỗi khi một lượt gọi kho xong (kể cả lỗi); kết quả, lỗi và thời gian trả về giữ nguyên. */
export function withTabSync(db: MockDb, sync: Pick<TabSync, 'afterOperation'>): MockDb {
  const wrapped: Record<string, unknown> = {}
  for (const [name, method] of Object.entries(db) as [string, unknown][]) {
    if (typeof method !== 'function') {
      wrapped[name] = method
      continue
    }
    wrapped[name] = (...args: unknown[]) => {
      const result: unknown = Reflect.apply(method, db, args)
      if (result instanceof Promise) return result.finally(sync.afterOperation)
      sync.afterOperation()
      return result
    }
  }
  return wrapped as MockDb
}
