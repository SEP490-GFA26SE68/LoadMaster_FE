/**
 * Hình thùng xe của phần "Một chuyến hàng" (thuần, không React): thùng nhìn ngang — cabin bên trái, cửa sau bên phải —, bốn vùng theo
 * điểm giao (điểm 4 sâu nhất, điểm 1 sát cửa) và các kiện của từng vùng, cùng tiến độ cuộn của năm chặng. Hình là trang trí; số kiện và
 * kích thước là của hình, không phải của chuyến nào. Mỗi kiện mang hai ngưỡng trên tiến độ `p` (0 → 1 qua năm chặng): `on` — lúc kiện
 * lên xe (chặng 2, vùng sâu nhất trước), `off` — lúc kiện được dỡ (chặng 4, vùng sát cửa trước). CSS đọc `p` và hai ngưỡng để tô kiện.
 */

/** Năm chặng theo thứ tự của chuyến: lập kế hoạch → xếp ở kho → trên đường → tại điểm giao → giao xong. */
export const CHAPTERS = ['plan', 'load', 'road', 'stop', 'done'] as const
export type ChapterKey = (typeof CHAPTERS)[number]

/** Khoảng `p` của chặng xếp và chặng dỡ; kiện đổi trạng thái trong khoảng đó, ngoài khoảng thì đứng yên. */
const LOAD = { from: 0.21, span: 0.17 } as const
const UNLOAD = { from: 0.61, span: 0.17 } as const

/** Khung của hình (đơn vị của `viewBox`). */
export const TRUCK_VIEW = { width: 720, height: 280 } as const
/** Lòng thùng: từ vách trước (sau cabin) tới cửa sau. */
export const CARGO = { x: 168, y: 36, width: 514, height: 166 } as const
const ZONE_GAP = 6
const BOX_GAP = 2
const COLUMN_WIDTH = 40

/** Bốn vùng từ vách trước ra cửa: điểm giao cuối nằm sâu nhất. Mỗi vùng ba cột kiện, mỗi cột liệt kê chiều cao kiện từ sàn lên. */
const ZONE_COLUMNS: readonly { stop: number; columns: readonly (readonly number[])[] }[] = [
  { stop: 4, columns: [[56, 52, 54], [40, 40, 40, 40], [60, 48, 54]] },
  { stop: 3, columns: [[48, 48, 48], [64, 50, 48], [40, 40, 40, 40]] },
  { stop: 2, columns: [[52, 52, 56], [44, 44, 44], [56, 56]] },
  { stop: 1, columns: [[40, 40, 40], [60, 52], [48, 48]] },
]

export type TruckZone = { readonly stop: number; readonly x: number; readonly width: number }
export type TruckBox = {
  readonly id: string
  readonly stop: number
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  /** Tiến độ mà kiện đã lên xe. */
  readonly on: number
  /** Tiến độ mà kiện đã được dỡ. */
  readonly off: number
}

const ZONE_WIDTH = (CARGO.width - ZONE_GAP * (ZONE_COLUMNS.length - 1)) / ZONE_COLUMNS.length

export const TRUCK_ZONES: readonly TruckZone[] = ZONE_COLUMNS.map(({ stop }, index) => ({
  stop,
  x: CARGO.x + index * (ZONE_WIDTH + ZONE_GAP),
  width: ZONE_WIDTH,
}))

type Slot = Omit<TruckBox, 'on' | 'off'> & { readonly zone: number; readonly column: number; readonly level: number }

function slots(): Slot[] {
  const floor = CARGO.y + CARGO.height
  return ZONE_COLUMNS.flatMap(({ stop, columns }, zone) =>
    columns.flatMap((heights, column) => {
      const x = TRUCK_ZONES[zone]!.x + column * (COLUMN_WIDTH + BOX_GAP)
      let top = floor
      return heights.map((height, level) => {
        top -= height + (level === 0 ? 0 : BOX_GAP)
        return { id: `${stop}-${column}-${level}`, stop, x, y: top, width: COLUMN_WIDTH, height, zone, column, level }
      })
    }),
  )
}

const round = (value: number) => Math.round(value * 10_000) / 10_000

/**
 * Các kiện của hình kèm hai ngưỡng. Xếp: vùng sâu nhất trước, trong vùng từ cột trong ra cột ngoài, mỗi cột từ sàn lên. Dỡ: vùng sát cửa
 * trước, trong vùng từ cột ngoài vào, mỗi cột từ trên xuống — kiện gần cửa ra trước.
 */
export function truckBoxes(): TruckBox[] {
  const all = slots()
  const count = all.length
  const unloadOrder = [...all].sort((a, b) => b.zone - a.zone || b.column - a.column || b.level - a.level)
  const offIndex = new Map(unloadOrder.map((slot, index) => [slot.id, index]))
  return all.map(({ zone: _zone, column: _column, level: _level, ...box }, index) => ({
    ...box,
    on: round(LOAD.from + (index * LOAD.span) / count),
    off: round(UNLOAD.from + ((offIndex.get(box.id) ?? 0) * UNLOAD.span) / count),
  }))
}

export type ChapterBox = { readonly top: number; readonly height: number }
export type JourneyState = { readonly p: number; readonly chapter: number }

/**
 * Tiến độ của năm chặng so với mốc `anchor` của khung nhìn (px từ đỉnh). Chặng đang xem là chặng cuối cùng có mép trên đã qua mốc; mỗi
 * chặng chiếm đúng một phần năm của `p` dù cao bao nhiêu. Chưa tới chặng đầu: `p` = 0; qua hết chặng cuối: 1. `quantized` (giảm chuyển
 * động): `p` là giữa chặng — hình đổi theo từng chặng, không theo từng điểm cuộn.
 */
export function journeyState(chapters: readonly ChapterBox[], anchor: number, quantized = false): JourneyState {
  const count = chapters.length
  if (count === 0) return { p: 0, chapter: 0 }
  let chapter = -1
  chapters.forEach((box, index) => {
    if (box.top <= anchor) chapter = index
  })
  if (chapter < 0) return { p: quantized ? 0.5 / count : 0, chapter: 0 }
  if (quantized) return { p: round((chapter + 0.5) / count), chapter }
  const box = chapters[chapter]!
  const fraction = box.height > 0 ? Math.min(1, Math.max(0, (anchor - box.top) / box.height)) : 1
  return { p: round((chapter + fraction) / count), chapter }
}
