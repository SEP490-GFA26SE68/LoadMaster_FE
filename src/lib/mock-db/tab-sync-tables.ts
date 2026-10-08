import type { DbState } from './db-context'

/**
 * Các bảng của kho nhìn như bảng khoá → bản ghi, và cách so một bảng với bản đã gửi (`tab-sync.ts`). Mọi trường của `DbState` là `Map`
 * (hoặc mảng `events`, hoặc `session` không bao giờ đồng bộ); trường mới thuộc dạng khác thì test của `tab-sync` báo.
 */

/** Bảng chỉ ghi bằng cách thay cả bản ghi hoặc thêm bản ghi mới: so theo danh tính object, không cần so nội dung. */
const REPLACE_ONLY = new Set(['packages', 'revisions', 'events'])

export type Table = {
  replaceOnly: boolean
  entries(): Iterable<[string, unknown]>
  set(key: string, value: unknown): void
  delete(key: string): void
  clear(): void
  /** Sau một lô thay đổi. */
  settle(): void
}

export function tablesOf(state: DbState): Map<string, Table> {
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


export type Entry = { ref: unknown; json: string | null }
export type Shadow = Map<string, Map<string, Entry>>
export type Change = { set: [string, unknown][]; del: string[] }
export type Changes = Record<string, Change>

export function buildShadowOf(tables: Map<string, Table>): Shadow {
  const built: Shadow = new Map()
  for (const [name, table] of tables) {
    const entries = new Map<string, Entry>()
    for (const [key, record] of table.entries()) entries.set(key, { ref: record, json: table.replaceOnly ? null : JSON.stringify(record) })
    built.set(name, entries)
  }
  return built
}

/** Thay đổi của các bảng so với `shadow` (bản đã gửi hoặc đã nhận); cập nhật luôn `shadow`. */
export function diffTables(tables: Map<string, Table>, shadow: Shadow): Changes {
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
