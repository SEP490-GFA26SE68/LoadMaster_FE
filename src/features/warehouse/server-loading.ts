import type { PlacementOutcome, ServerLoadingSession, ServerManualState, ServerPlacement, ServerStagingState } from './warehouse-server-api'

/** Một kiện của phiên xếp bản máy chủ và trạng thái của nó trên màn. */
export type ServerPlacementState = PlacementOutcome | 'current' | 'pending'

export type ServerLoadingRow = {
  readonly placement: ServerPlacement
  readonly state: ServerPlacementState
  /** Xác nhận tay bước xếp của kiện còn chờ điều phối viên duyệt. */
  readonly manualPending: boolean
}

export type ServerLoadingView = {
  readonly total: number
  /** Kiện đã có kết quả (xếp đúng chỗ, kèm sai lệch, hoặc hỏng bị bỏ lại kho). */
  readonly done: number
  /** Kiện cần xếp kế tiếp: kiện chưa có kết quả đầu tiên theo thứ tự xếp — máy chủ từ chối xác nhận sai thứ tự. */
  readonly current: ServerPlacement | undefined
  /** Xác nhận tay bước xếp của kiện kế tiếp bị điều phối viên từ chối: kho phải đối chiếu lại, kèm lý do. */
  readonly currentRejected: ServerManualState | null
  /** Vị trí (từ 1) của kiện kế tiếp trong thứ tự xếp. */
  readonly step: number
  readonly rows: readonly ServerLoadingRow[]
}

const NO_STAGING: ServerStagingState = { staged: false, shortage: null, manual: null }

const stagingOf = (session: ServerLoadingSession, placement: ServerPlacement) => session.staging[placement.id] ?? NO_STAGING

/** Hàm thuần: tiến độ của phiên xếp theo kết quả máy chủ đã ghi. */
export function serverLoadingView(session: ServerLoadingSession): ServerLoadingView {
  const index = session.placements.findIndex((placement) => session.outcomes[placement.id] === undefined)
  const current = index === -1 ? undefined : session.placements[index]
  const rows = session.placements.map((placement) => {
    const outcome = session.outcomes[placement.id]
    const state: ServerPlacementState = outcome ?? (placement.id === current?.id ? 'current' : 'pending')
    const manual = stagingOf(session, placement).manual
    return { placement, state, manualPending: manual?.step === 'LOADING' && manual.status === 'PENDING' }
  })
  const done = rows.filter((row) => row.state !== 'current' && row.state !== 'pending').length
  const manual = current === undefined ? null : stagingOf(session, current).manual
  return {
    total: session.placements.length,
    done,
    current,
    currentRejected: manual?.step === 'LOADING' && manual.status === 'REJECTED' ? manual : null,
    step: index === -1 ? session.placements.length : index + 1,
    rows,
  }
}

export type ServerStagingRow = {
  readonly placement: ServerPlacement
  /** `open` — kho đã báo thiếu, chờ điều phối viên; `keepSearching` — điều phối viên bảo tìm tiếp. */
  readonly shortage: ServerStagingState['shortage']
  /** Lý do điều phối viên từ chối xác nhận tay bước soạn của kiện, khi có. */
  readonly rejectReason: string | null
  /** Kho đã gửi xác nhận tay bước soạn, chờ điều phối viên duyệt: chưa tính là đã soạn. */
  readonly manualPending: boolean
}

export type ServerStagingView = {
  /** Kiện phải soạn: kiện của phương án có mã kho kiện (máy chủ chỉ soạn kiện thật). */
  readonly total: number
  readonly staged: number
  /** Kiện chưa soạn, theo thứ tự xếp. */
  readonly pending: readonly ServerStagingRow[]
  /** Kiện đang báo thiếu chờ điều phối viên quyết. */
  readonly openShortages: number
  /** Kiện có xác nhận tay bước soạn chờ điều phối viên duyệt. */
  readonly manualPending: number
}

/** Hàm thuần: tiến độ soạn hàng của phiên — soạn không cần thứ tự, nên chỉ đếm và liệt kê kiện chưa soạn. */
export function serverStagingView(session: ServerLoadingSession): ServerStagingView {
  const placements = session.placements.filter((placement) => placement.packageId !== null)
  const pending = placements.flatMap((placement) => {
    const state = stagingOf(session, placement)
    if (state.staged) return []
    const manual = state.manual?.step === 'STAGING' ? state.manual : null
    return [{
      placement,
      shortage: state.shortage,
      rejectReason: manual?.status === 'REJECTED' ? (manual.rejectReason ?? null) : null,
      manualPending: manual?.status === 'PENDING',
    }]
  })
  return {
    total: placements.length,
    staged: placements.length - pending.length,
    pending,
    openShortages: pending.filter((row) => row.shortage === 'open').length,
    manualPending: pending.filter((row) => row.manualPending).length,
  }
}

/** Mã in trên nhãn để hiện cho kho: mã của bên gửi, không thì mã vạch, không thì mã kho kiện. */
export function placementLabel(placement: ServerPlacement): string {
  return placement.packageCode ?? placement.barcode ?? placement.packageId ?? placement.id
}

/** Dung sai chạm mặt (cm), như máy chủ đếm kiện tựa lên khi ghi kiện hỏng. */
const TOUCH_CM = 0.5

/**
 * Số kiện của phương án tựa lên kiện này (đáy chạm nóc của nó và chồng lên nhau trên mặt sàn) — hàm thuần, cùng phép đếm với máy chủ: 0 thì
 * kiện hỏng được bỏ lại kho và xếp tiếp, lớn hơn 0 thì chuyến về Đã lập kế hoạch. Chỉ để hộp xác nhận nói trước hệ quả; máy chủ quyết.
 */
export function restingCount(session: ServerLoadingSession, target: ServerPlacement): number {
  const top = target.z + target.heightCm
  const overlaps = (a0: number, a1: number, b0: number, b1: number) => Math.min(a1, b1) - Math.max(a0, b0) > TOUCH_CM
  return session.placements.filter((other) =>
    other.id !== target.id
    && Math.abs(other.z - top) <= TOUCH_CM
    && overlaps(other.x, other.x + other.lengthCm, target.x, target.x + target.lengthCm)
    && overlaps(other.y, other.y + other.widthCm, target.y, target.y + target.widthCm),
  ).length
}
