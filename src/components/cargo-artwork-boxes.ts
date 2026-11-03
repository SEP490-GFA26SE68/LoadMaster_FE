import type { IsoBox } from '@/lib/isometric'
import { stopColor } from '@/lib/stops'

/**
 * Hình học của hình minh hoạ thùng xe `CargoArtwork` (màn đăng nhập, trang giới thiệu — màn không có dữ liệu, AGENTS.md mục 5):
 * một thùng 7,2 × 2,35 × 2,4 m xếp kín theo điểm giao, sâu nhất là điểm 4. Chỉ để trang trí — không phải kết quả tối ưu nào, không
 * hiện số liệu.
 * Tách khỏi dữ liệu thuật toán giả cũ của màn So sánh phương án ở LM-051.
 */

export const ARTWORK_CONTAINER = { length: 7.2, width: 2.35, height: 2.4 }

const COLUMN_LENGTHS = [0.78, 0.82, 0.58, 0.66, 0.6, 0.7, 0.62, 0.68, 0.7, 0.6]
const ROWS: Array<[y: number, width: number]> = [
  [0.05, 0.72],
  [0.82, 0.74],
  [1.61, 0.7],
]

/** Điểm giao theo vị trí dọc thùng: vách trước là điểm giao cuối, cửa sau là điểm đầu. */
function stopByPosition(x: number): number {
  if (x < 1.7) return 4
  if (x < 3.7) return 3
  if (x < 5.7) return 2
  return 1
}

/** Khối hàng hai lớp theo cột, để trống lớp trên ở vài ô sát cửa cho hình có nhịp. */
export function artworkBoxes(): IsoBox[] {
  const boxes: IsoBox[] = []
  let x = 0.06

  COLUMN_LENGTHS.forEach((columnLength, ci) => {
    if (x + columnLength > ARTWORK_CONTAINER.length - 0.05) return

    ROWS.forEach(([y, width], ri) => {
      const color = stopColor(stopByPosition(x))
      const baseHeight = 0.98 + ((ci + ri) % 2) * 0.1
      boxes.push({ x, y, z: 0, length: columnLength, width, height: baseHeight, color })

      if (!(ci >= 8 && ri === 1)) {
        boxes.push({
          x,
          y,
          z: baseHeight + 0.02,
          length: columnLength,
          width,
          height: 0.8 + ((ci + ri + 1) % 2) * 0.12,
          color,
        })
      }
    })

    x += columnLength + 0.06
  })

  return boxes
}
