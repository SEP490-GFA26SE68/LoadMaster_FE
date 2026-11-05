import type { ServerLoadingSession, ServerPlacement } from './warehouse-server-api'

/** Một kiện của phiên xếp bản máy chủ và trạng thái của nó trên màn. */
export type ServerPlacementState = 'confirmed' | 'deviation' | 'current' | 'pending'

export type ServerLoadingView = {
  readonly total: number
  /** Kiện đã có kết quả (xếp đúng chỗ hoặc kèm sai lệch). */
  readonly done: number
  /** Kiện cần xếp kế tiếp: kiện chưa có kết quả đầu tiên theo thứ tự xếp — máy chủ từ chối xác nhận sai thứ tự. */
  readonly current: ServerPlacement | undefined
  /** Vị trí (từ 1) của kiện kế tiếp trong thứ tự xếp. */
  readonly step: number
  readonly rows: readonly { readonly placement: ServerPlacement; readonly state: ServerPlacementState }[]
}

/** Hàm thuần: tiến độ của phiên xếp theo kết quả tab đã ghi. */
export function serverLoadingView(session: ServerLoadingSession): ServerLoadingView {
  const index = session.placements.findIndex((placement) => session.outcomes[placement.id] === undefined)
  const current = index === -1 ? undefined : session.placements[index]
  const rows = session.placements.map((placement) => {
    const outcome = session.outcomes[placement.id]
    const state: ServerPlacementState = outcome ?? (placement.id === current?.id ? 'current' : 'pending')
    return { placement, state }
  })
  const done = rows.filter((row) => row.state === 'confirmed' || row.state === 'deviation').length
  return { total: session.placements.length, done, current, step: index === -1 ? session.placements.length : index + 1, rows }
}
