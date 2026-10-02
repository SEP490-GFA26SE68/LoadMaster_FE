import { gt } from '@/domain/geometry'
import { HANDLING_CLASSES, type HandlingClass } from '@/domain/models'
import { cellText, isBlankRow, parseDecimal, type ImportCell } from '@/features/trips/import-cells'
import type { TFunction } from '@/lib/i18n'
import { normalizeSearchText } from '@/lib/list-filter'
import type { Package, PackageInput, PackageType } from '@/lib/mock-db'

/**
 * Nhập file vào kho kiện (FE-3b-02, D-68, D-69): đọc bảng ô của `.csv` / `.xlsx` theo cột của backend, kiểm từng dòng, dựng bản xem
 * trước. Hàm thuần — trả **mã + tham số**, màn dịch. Cột tìm theo tiêu đề (tiếng Việt hoặc tên cột của backend, có hay không có đơn
 * vị), không theo vị trí. Đơn vị trong file là cm / kg. Số dòng là số dòng khi mở file bằng Excel (đếm từ 1, tiêu đề là dòng 1).
 * Có một dòng lỗi thì `importInputs` trả `null`: không dòng nào được ghi.
 */
export const IMPORT_COLUMNS = ['package_code', 'length', 'width', 'height', 'weight', 'handling_class', 'destination', 'package_type'] as const
export type ImportColumn = (typeof IMPORT_COLUMNS)[number]
const OPTIONAL_COLUMNS: readonly ImportColumn[] = ['package_type']

export const MAX_IMPORT_FILE_MB = 10
export const MAX_IMPORT_ROWS = 1000

/** Tiêu đề nhận được của từng cột, đã bỏ dấu, chữ thường, `_` thành dấu cách và bỏ phần đơn vị trong ngoặc. */
const HEADER_ALIASES: Readonly<Record<ImportColumn, readonly string[]>> = {
  package_code: ['package code', 'ma kien', 'ma kien hang'],
  length: ['length', 'dai', 'chieu dai'],
  width: ['width', 'rong', 'chieu rong'],
  height: ['height', 'cao', 'chieu cao'],
  weight: ['weight', 'khoi luong', 'can nang'],
  handling_class: ['handling class', 'loai hang'],
  destination: ['destination', 'diem den'],
  package_type: ['package type', 'loai kien'],
}

const CLASS_ALIASES: Readonly<Record<HandlingClass, readonly string[]>> = {
  STANDARD: ['standard', 'thuong'],
  FRAGILE: ['fragile', 'de vo'],
  REFRIGERATED: ['refrigerated', 'hang lanh'],
  HAZARDOUS: ['hazardous', 'nguy hiem'],
  HIGH_VALUE: ['high value', 'gia tri cao'],
}

const plain = (text: string) => normalizeSearchText(text.replace(/\([^)]*\)/g, ' ').replaceAll('_', ' '))

export function columnOfHeader(header: string): ImportColumn | undefined {
  const name = plain(header)
  return IMPORT_COLUMNS.find((column) => HEADER_ALIASES[column].includes(name))
}

/** Loại hàng theo mã của backend (`FRAGILE`) hoặc nhãn tiếng Việt / tiếng Anh, không kể dấu và hoa thường. */
export function parseHandlingClass(text: string): HandlingClass | null {
  const name = plain(text)
  return HANDLING_CLASSES.find((value) => CLASS_ALIASES[value].includes(name)) ?? null
}

export type ImportFileError =
  | { readonly kind: 'error'; readonly code: 'UNSUPPORTED_FILE_TYPE' | 'EMPTY_FILE'; readonly params: Record<string, never> }
  | { readonly kind: 'error'; readonly code: 'FILE_TOO_LARGE'; readonly params: { maxMb: number } }
  | { readonly kind: 'error'; readonly code: 'BATCH_TOO_LARGE'; readonly params: { max: number; rows: number } }
  | { readonly kind: 'error'; readonly code: 'IMPORT_COLUMNS_MISSING'; readonly params: { columns: string[] } }

/** Lỗi thấy được trước khi đọc file: đuôi file, dung lượng. */
export function importFileError(file: { name: string; size: number }): ImportFileError | null {
  if (!/\.(csv|xlsx)$/i.test(file.name)) return { kind: 'error', code: 'UNSUPPORTED_FILE_TYPE', params: {} }
  if (file.size === 0) return { kind: 'error', code: 'EMPTY_FILE', params: {} }
  if (file.size > MAX_IMPORT_FILE_MB * 1024 * 1024) return { kind: 'error', code: 'FILE_TOO_LARGE', params: { maxMb: MAX_IMPORT_FILE_MB } }
  return null
}

export type ImportRowError =
  | { readonly code: 'PACKAGE_CODE_REQUIRED' | 'INVALID_WEIGHT' | 'DESTINATION_REQUIRED' }
  | { readonly code: 'INVALID_DIMENSION'; readonly field: 'length' | 'width' | 'height' }
  | { readonly code: 'INVALID_HANDLING_CLASS' | 'PACKAGE_TYPE_NOT_FOUND'; readonly value: string }
  | { readonly code: 'DUPLICATE_PACKAGE_CODE'; readonly firstLine: number }

/** Cảnh báo không chặn nhập: mã của bên gửi đã có ở kiện `packageId` của kho kiện. */
export type ImportRowWarning = { readonly code: 'PACKAGE_CODE_EXISTS'; readonly packageId: string }

export type ImportRow = {
  readonly line: number
  readonly packageCode: string
  readonly lengthCm: number | null
  readonly widthCm: number | null
  readonly heightCm: number | null
  readonly weightKg: number | null
  readonly handlingClass: HandlingClass | null
  readonly destination: string
  readonly packageTypeId?: string
  readonly errors: readonly ImportRowError[]
  readonly warnings: readonly ImportRowWarning[]
}

export type PackageImportPreview = {
  readonly kind: 'preview'
  readonly rows: readonly ImportRow[]
  readonly total: number
  /** Dòng không có lỗi (dòng chỉ có cảnh báo vẫn hợp lệ). */
  readonly valid: number
  readonly errorRows: number
  readonly warningRows: number
}

export type ImportContext = {
  readonly packageTypes: readonly Pick<PackageType, 'id' | 'name'>[]
  /** Kiện đang có trong kho kiện của công ty. */
  readonly existing: readonly Pick<Package, 'id' | 'packageCode'>[]
}

const codeKey = (code: string) => code.trim().toUpperCase()

/** Số dương của ô, hoặc `null` (ô trống, chữ, số ≤ 0). */
function positive(cell: ImportCell | undefined): number | null {
  const value = typeof cell === 'number' ? cell : parseDecimal(cellText(cell))
  return value !== null && Number.isFinite(value) && gt(value, 0) ? value : null
}

function findType(types: ImportContext['packageTypes'], text: string) {
  const name = normalizeSearchText(text)
  return types.find((type) => type.id.toUpperCase() === text.toUpperCase()) ?? types.find((type) => normalizeSearchText(type.name) === name)
}

export function parsePackageImport(table: readonly (readonly ImportCell[])[], context: ImportContext): PackageImportPreview | ImportFileError {
  const headerIndex = table.findIndex((cells) => !isBlankRow(cells))
  const body = table.map((cells, index) => ({ cells, line: index + 1 })).filter(({ cells, line }) => line - 1 > headerIndex && !isBlankRow(cells))
  if (headerIndex < 0 || body.length === 0) return { kind: 'error', code: 'EMPTY_FILE', params: {} }
  const index = new Map<ImportColumn, number>()
  table[headerIndex]?.forEach((cell, position) => {
    const column = columnOfHeader(cellText(cell))
    if (column !== undefined && !index.has(column)) index.set(column, position)
  })
  const missing = IMPORT_COLUMNS.filter((column) => !index.has(column) && !OPTIONAL_COLUMNS.includes(column))
  if (missing.length > 0) return { kind: 'error', code: 'IMPORT_COLUMNS_MISSING', params: { columns: missing } }
  if (body.length > MAX_IMPORT_ROWS) return { kind: 'error', code: 'BATCH_TOO_LARGE', params: { max: MAX_IMPORT_ROWS, rows: body.length } }

  const existing = new Map(context.existing.map((pkg) => [codeKey(pkg.packageCode), pkg.id]))
  const firstLine = new Map<string, number>()
  const rows = body.map(({ cells, line }): ImportRow => {
    const cell = (column: ImportColumn) => cells[index.get(column) ?? -1]
    const errors: ImportRowError[] = []
    const warnings: ImportRowWarning[] = []
    const packageCode = cellText(cell('package_code'))
    const sizes = (['length', 'width', 'height'] as const).map((field) => {
      const value = positive(cell(field))
      if (value === null) errors.push({ code: 'INVALID_DIMENSION', field })
      return value
    })
    const weightKg = positive(cell('weight'))
    if (weightKg === null) errors.push({ code: 'INVALID_WEIGHT' })
    const classText = cellText(cell('handling_class'))
    const handlingClass = parseHandlingClass(classText)
    if (handlingClass === null) errors.push({ code: 'INVALID_HANDLING_CLASS', value: classText })
    const destination = cellText(cell('destination'))
    if (destination === '') errors.push({ code: 'DESTINATION_REQUIRED' })
    if (packageCode === '') errors.push({ code: 'PACKAGE_CODE_REQUIRED' })
    else {
      const key = codeKey(packageCode)
      const first = firstLine.get(key)
      if (first === undefined) firstLine.set(key, line)
      else errors.push({ code: 'DUPLICATE_PACKAGE_CODE', firstLine: first })
      const packageId = existing.get(key)
      if (packageId !== undefined) warnings.push({ code: 'PACKAGE_CODE_EXISTS', packageId })
    }
    const typeText = cellText(cell('package_type'))
    const type = typeText === '' ? undefined : findType(context.packageTypes, typeText)
    if (typeText !== '' && !type) errors.push({ code: 'PACKAGE_TYPE_NOT_FOUND', value: typeText })
    return {
      line, packageCode, lengthCm: sizes[0] ?? null, widthCm: sizes[1] ?? null, heightCm: sizes[2] ?? null, weightKg, handlingClass, destination,
      ...(type ? { packageTypeId: type.id } : {}), errors, warnings,
    }
  })
  const errorRows = rows.filter((item) => item.errors.length > 0).length
  return { kind: 'preview', rows, total: rows.length, valid: rows.length - errorRows, errorRows, warningRows: rows.filter((item) => item.warnings.length > 0).length }
}

/** Đầu vào của kho cho mọi dòng — chỉ khi **không dòng nào** có lỗi; còn lỗi thì `null` (D-68: có dòng lỗi thì không lưu dòng nào). */
export function importInputs(preview: PackageImportPreview): PackageInput[] | null {
  const inputs: PackageInput[] = []
  for (const row of preview.rows) {
    const { lengthCm, widthCm, heightCm, weightKg, handlingClass } = row
    if (row.errors.length > 0 || lengthCm === null || widthCm === null || heightCm === null || weightKg === null || handlingClass === null) return null
    inputs.push({
      packageCode: row.packageCode, lengthCm, widthCm, heightCm, weightKg, handlingClass, destination: row.destination,
      ...(row.packageTypeId === undefined ? {} : { packageTypeId: row.packageTypeId }),
    })
  }
  return inputs
}

/**
 * File mẫu: tiêu đề theo ngôn ngữ đang chọn (kích thước, khối lượng ghi đơn vị) và hai dòng ví dụ — loại hàng viết bằng mã của
 * backend, cột loại kiện để trống — nên nhập nguyên file mẫu ra hai kiện hợp lệ.
 */
export function importTemplateRows(t: TFunction): (string | number)[][] {
  return [
    IMPORT_COLUMNS.map((column) => t(`sourcing.import.header.${column}`)),
    [t('sourcing.import.sample.firstCode'), 60, 40, 40, 18, 'STANDARD', t('sourcing.import.sample.firstDestination'), ''],
    [t('sourcing.import.sample.secondCode'), 50, 40, 30, 9.5, 'FRAGILE', t('sourcing.import.sample.secondDestination'), ''],
  ]
}
