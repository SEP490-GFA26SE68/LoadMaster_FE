import { HANDLING_CLASSES, type FragilityLevel, type HandlingClass } from '@/domain/models'
import { createTranslator, LOCALES } from '@/lib/i18n'
import { normalizeSearchText } from '@/lib/list-filter'

/**
 * Cột của file nhập kiện (LM-093, D-49): đúng tên trường `CargoPackage` (Spec mục 6), theo thứ tự file mẫu. Dòng tiêu đề nhận cả tên
 * trường lẫn tiêu đề tiếng Việt / tiếng Anh của từ điển (`trips.import.columns`), không phân biệt dấu, hoa thường và phần đơn vị trong
 * ngoặc: "Dài (cm)", "dai", "Length (cm)", "lengthCm" cùng là một cột.
 */
export const IMPORT_FIELDS = [
  'id',
  'name',
  'lengthCm',
  'widthCm',
  'heightCm',
  'weightKg',
  'quantity',
  'deliveryStop',
  'allowedOrientations',
  'keepUpright',
  'fragilityLevel',
  'stackable',
  'maxTopLoadKg',
  'maxStackCount',
  'minSupportRatio',
  'priority',
  'mustLoad',
  'groupId',
  'notes',
  // FE-3b-07 (D-68): loại hàng của kiện kho kiện tạo từ dòng này; đứng cuối để file theo mẫu cũ (19 cột) vẫn nhập được
  'handlingClass',
] as const

export type ImportField = (typeof IMPORT_FIELDS)[number]

/** Cột phải có trong dòng tiêu đề; cột khác vắng hoặc ô trống thì lấy giá trị mặc định như kiện mới của form (LM-045). */
export const REQUIRED_FIELDS: readonly ImportField[] = ['id', 'name', 'lengthCm', 'widthCm', 'heightCm', 'weightKg', 'quantity', 'deliveryStop']

/** Tiêu đề cột để so: bỏ phần trong ngoặc (đơn vị), bỏ dấu, chỉ giữ chữ và số. "Khối lượng (kg)" → "khoiluong". */
export function normalizeHeader(title: string): string {
  return normalizeSearchText(title.replace(/\([^)]*\)/g, ' ')).replace(/[^a-z0-9]/g, '')
}

let headerAliases: ReadonlyMap<string, ImportField> | undefined
let fragilityAliases: ReadonlyMap<string, FragilityLevel> | undefined
let handlingAliases: ReadonlyMap<string, HandlingClass> | undefined

/** Tiêu đề cột đã chuẩn hoá → trường: tên trường, tiêu đề vi và en. Hai trường trùng một tiêu đề là lỗi lập trình, báo ngay. */
export function importHeaderAliases(): ReadonlyMap<string, ImportField> {
  if (headerAliases) return headerAliases
  const aliases = new Map<string, ImportField>()
  const add = (title: string, field: ImportField) => {
    const key = normalizeHeader(title)
    const taken = aliases.get(key)
    if (taken !== undefined && taken !== field) throw new Error(`Tiêu đề cột "${title}" trùng giữa ${taken} và ${field}`)
    aliases.set(key, field)
  }
  for (const field of IMPORT_FIELDS) add(field, field)
  for (const locale of LOCALES) {
    const t = createTranslator(locale)
    for (const field of IMPORT_FIELDS) add(t(`trips.import.columns.${field}`), field)
  }
  headerAliases = aliases
  return aliases
}

const FRAGILITY_LEVELS: readonly FragilityLevel[] = ['NONE', 'LOW', 'MEDIUM', 'HIGH']

/** Mức dễ vỡ đã bỏ dấu → mã: chính mã (`NONE`…) và nhãn vi/en của form kiện ("Trung bình", "Medium"). */
export function importFragilityAliases(): ReadonlyMap<string, FragilityLevel> {
  if (fragilityAliases) return fragilityAliases
  const aliases = new Map<string, FragilityLevel>()
  for (const level of FRAGILITY_LEVELS) aliases.set(normalizeSearchText(level), level)
  for (const locale of LOCALES) {
    const t = createTranslator(locale)
    for (const level of FRAGILITY_LEVELS) aliases.set(normalizeSearchText(t(`trips.form.fragilityLevels.${level}`)), level)
  }
  fragilityAliases = aliases
  return aliases
}

/** Loại hàng đã bỏ dấu → mã: chính mã (`FRAGILE`…) và nhãn vi/en của chip loại hàng ("Dễ vỡ", "Fragile"). */
export function importHandlingAliases(): ReadonlyMap<string, HandlingClass> {
  if (handlingAliases) return handlingAliases
  const aliases = new Map<string, HandlingClass>()
  for (const handlingClass of HANDLING_CLASSES) aliases.set(normalizeSearchText(handlingClass), handlingClass)
  for (const locale of LOCALES) {
    const t = createTranslator(locale)
    for (const handlingClass of HANDLING_CLASSES) aliases.set(normalizeSearchText(t(`common.handlingClasses.${handlingClass}`)), handlingClass)
  }
  handlingAliases = aliases
  return aliases
}
