import qrcode from 'qrcode-generator'

/**
 * Mã QR của kiện (LM-104), phần thuần: mã hoá token thành ma trận module và dựng một `path` SVG duy nhất. Không React, để test ở
 * node và để `QrCode.tsx` chỉ lo phần vẽ.
 */

/** Vùng yên lặng quanh mã: 4 module mỗi phía theo chuẩn QR, máy quét cần nó để tìm ba ô định vị. */
export const QR_QUIET_ZONE = 4

export type QrPath = {
  /** Cạnh của cả hình tính bằng module, đã gồm vùng yên lặng hai phía — dùng làm `viewBox`. */
  size: number
  /** Số module của ma trận (chưa gồm vùng yên lặng). */
  modules: number
  /** Thuộc tính `d`: mỗi đoạn module tối liền nhau trên một hàng là một hình chữ nhật cao 1. */
  d: string
}

/**
 * Chuẩn hoá token người dùng gõ hoặc máy quét đọc được: bỏ khoảng trắng hai đầu và ở giữa, viết hoa. Mã kiện và mã chuyến
 * đều viết hoa không khoảng trắng, nên "  pkg-001 " và "PKG - 001" cùng thành "PKG-001".
 */
export function normalizeQrToken(raw: string): string {
  return raw.replace(/\s+/g, '').toUpperCase()
}

/** Mức sửa lỗi M (~15 %): nhãn in dán trên thùng carton hay trầy góc. Phiên bản QR chọn tự động theo độ dài token. */
export function qrPath(token: string): QrPath {
  const code = qrcode(0, 'M')
  code.addData(token, 'Byte')
  code.make()
  const modules = code.getModuleCount()
  const parts: string[] = []
  for (let row = 0; row < modules; row += 1) {
    let col = 0
    while (col < modules) {
      if (!code.isDark(row, col)) {
        col += 1
        continue
      }
      const start = col
      while (col < modules && code.isDark(row, col)) col += 1
      parts.push(`M${start + QR_QUIET_ZONE} ${row + QR_QUIET_ZONE}h${col - start}v1h-${col - start}z`)
    }
  }
  return { size: modules + QR_QUIET_ZONE * 2, modules, d: parts.join('') }
}
