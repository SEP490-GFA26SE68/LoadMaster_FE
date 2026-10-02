import type { ModelIssueCode } from '@/domain/models'
import type { Formatter } from '@/lib/format'
import { formatIssue, type MessageKey, type TFunction } from '@/lib/i18n'
import type { ImportField } from './package-import-columns'
import type { ImportFileProblem, ImportProblem } from './package-import'
import { packageFieldError } from './package-form-errors'

/**
 * Câu cho lỗi của file nhập kiện (LM-093): `package-import.ts` chỉ trả mã + tham số (D-28), ở đây chọn câu theo ngôn ngữ đang chọn.
 * Lỗi ràng buộc domain đi qua `formatIssue`; lỗi schema dùng lại câu của form kiện (`packageFieldError`), thêm câu cho mã form không có.
 */

/** Mã schema mà form kiện không báo (form tự đồng bộ hoặc không có ô tương ứng). */
const IMPORT_ONLY_MESSAGES = {
  'package.allowedOrientations.duplicate': 'trips.import.errors.orientationDuplicate',
  'package.keepUpright.orientation': 'trips.import.errors.uprightOnly',
  'package.deliveryStop.integer': 'trips.import.errors.stopNumber',
  'package.deliveryStop.min': 'trips.import.errors.stopNumber',
} as const satisfies Partial<Record<ModelIssueCode, MessageKey>>

type ImportOnlyKey = (typeof IMPORT_ONLY_MESSAGES)[keyof typeof IMPORT_ONLY_MESSAGES]

/** Tiêu đề cột theo ngôn ngữ đang chọn, đúng như dòng tiêu đề của file mẫu. */
export function columnTitle(field: ImportField, t: TFunction): string {
  return t(`trips.import.columns.${field}`)
}

function schemaMessage(issue: ModelIssueCode, t: TFunction): string {
  const key: ImportOnlyKey | undefined = (IMPORT_ONLY_MESSAGES as Readonly<Partial<Record<string, ImportOnlyKey>>>)[issue]
  return key ? t(key) : packageFieldError(issue, t) ?? t('trips.form.errors.invalid')
}

export function importProblemMessage(problem: ImportProblem, t: TFunction, format: Formatter): string {
  switch (problem.code) {
    case 'CELL_REQUIRED':
      return t('trips.import.errors.CELL_REQUIRED', { column: columnTitle(problem.field, t) })
    case 'NUMBER_INVALID':
    case 'BOOLEAN_INVALID':
    case 'ORIENTATION_INVALID':
    case 'FRAGILITY_INVALID':
    case 'HANDLING_CLASS_INVALID':
      return t(`trips.import.errors.${problem.code}`, { column: columnTitle(problem.field, t), value: problem.value })
    case 'SCHEMA': {
      const message = schemaMessage(problem.issue, t)
      return problem.field ? t('trips.import.errors.SCHEMA', { column: columnTitle(problem.field, t), message }) : message
    }
    case 'DUPLICATE_IN_FILE':
      // Số dòng là số thứ tự, không nhóm nghìn như số lượng
      return t('trips.import.errors.DUPLICATE_IN_FILE', { id: problem.id, row: String(problem.firstRow) })
    case 'DUPLICATE_EXISTING':
      return t('trips.import.errors.DUPLICATE_EXISTING', { id: problem.id })
    case 'STOP_UNKNOWN':
      return t('trips.import.errors.STOP_UNKNOWN', { stop: problem.stop, stops: problem.stopCount })
    case 'CONSTRAINT':
      return formatIssue(problem.issue, t, format)
  }
}

/** Lỗi cả file: không đọc được, không có dòng, thiếu/trùng cột, quá dài. */
export function importFileProblemMessage(problem: ImportFileProblem | { readonly code: 'UNREADABLE' }, t: TFunction, format: Formatter): string {
  switch (problem.code) {
    case 'EMPTY':
      return t('trips.import.fileErrors.EMPTY')
    case 'UNREADABLE':
      return t('trips.import.fileErrors.UNREADABLE')
    case 'MISSING_COLUMNS':
      return t('trips.import.fileErrors.MISSING_COLUMNS', { columns: format.list(problem.fields.map((field) => columnTitle(field, t))) })
    case 'DUPLICATE_COLUMN':
      return t('trips.import.fileErrors.DUPLICATE_COLUMN', { column: columnTitle(problem.field, t) })
    case 'TOO_MANY_ROWS':
      return t('trips.import.fileErrors.TOO_MANY_ROWS', { max: format.integer(problem.max) })
  }
}
