import { cellText, isBlankRow, parseDecimal, type ImportCell } from '@/features/trips/import-cells'
import { toCsv } from '@/features/trips/package-import-template'
import { normalizeSearchText } from '@/lib/list-filter'
import type { PackageType, RegisteredPackageRow } from '@/lib/mock-db'

/**
 * Nhập file đăng ký kiện (LM-104): mỗi dòng một loại kiện — mã loại kiện (hoặc đúng tên), số lượng, mã lô / SKU, ghi chú — theo vị
 * trí cột, nên file tiếng Việt hay tiếng Anh đều đọc được. Dòng đầu có chữ là tiêu đề; dòng trống bị bỏ. Kiểm hết mọi dòng trước:
 * còn dòng lỗi thì không ghi (kho cũng kiểm lại, `registerPackageRows`). Hàm thuần, câu lỗi là mã.
 */
export type RegisterProblem =
  | { readonly code: 'typeMissing' }
  | { readonly code: 'typeUnknown'; readonly value: string }
  | { readonly code: 'quantityInvalid' }

export type ParsedRegisterRow = {
  /** Số dòng như khi mở file bằng Excel (đếm từ 1, kể cả tiêu đề). */
  readonly line: number
  readonly typeText: string
  readonly type: PackageType | undefined
  readonly quantity: number | null
  readonly reference: string
  readonly note: string
  readonly problems: readonly RegisterProblem[]
}

export function findType(types: readonly PackageType[], text: string): PackageType | undefined {
  const code = text.trim().toUpperCase()
  const name = normalizeSearchText(text)
  return types.find((type) => type.id.toUpperCase() === code) ?? types.find((type) => normalizeSearchText(type.name) === name)
}

export function parseRegisterTable(table: readonly (readonly ImportCell[])[], types: readonly PackageType[], maxQuantity: number): ParsedRegisterRow[] {
  const headerIndex = table.findIndex((cells) => !isBlankRow(cells))
  if (headerIndex < 0) return []
  const rows: ParsedRegisterRow[] = []
  table.forEach((cells, index) => {
    if (index <= headerIndex || isBlankRow(cells)) return
    const typeText = cellText(cells[0])
    const rawQuantity = cellText(cells[1])
    const quantity = rawQuantity === '' ? null : parseDecimal(rawQuantity)
    const type = typeText === '' ? undefined : findType(types, typeText)
    const problems: RegisterProblem[] = []
    if (typeText === '') problems.push({ code: 'typeMissing' })
    else if (!type) problems.push({ code: 'typeUnknown', value: typeText })
    if (quantity === null || !Number.isInteger(quantity) || quantity < 1 || quantity > maxQuantity) problems.push({ code: 'quantityInvalid' })
    rows.push({ line: index + 1, typeText, type, quantity, reference: cellText(cells[2]), note: cellText(cells[3]), problems })
  })
  return rows
}

/** Dòng hợp lệ → đầu vào của kho; `ownerCompanyId` chỉ khi người đăng ký chọn công ty (quản trị viên). */
export function toRegisterRows(rows: readonly ParsedRegisterRow[], ownerCompanyId?: string): RegisteredPackageRow[] {
  return rows.flatMap((row) => row.type && row.quantity !== null && row.problems.length === 0
    ? [{
        packageTypeId: row.type.id,
        quantity: row.quantity,
        ...(row.reference === '' ? {} : { reference: row.reference }),
        ...(row.note === '' ? {} : { note: row.note }),
        ...(ownerCompanyId === undefined ? {} : { ownerCompanyId }),
      }]
    : [])
}

/**
 * File mẫu CSV: tiêu đề theo ngôn ngữ đang chọn + một dòng cho mỗi loại kiện đầu danh mục (tối đa 2) — loại có thật trong kho, nên
 * nhập nguyên file mẫu cũng ra kiện hợp lệ.
 */
export function registerTemplateCsv(header: readonly string[], types: readonly PackageType[]): string {
  const samples = types.slice(0, 2).map((type, index) => [type.id, index === 0 ? 10 : 4, '', ''])
  return toCsv([header, ...samples])
}
