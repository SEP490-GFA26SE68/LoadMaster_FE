import type { ConstraintIssue } from '@/domain/constraints'
import type { Formatter } from '@/lib/format'
import type { MessageKey, TFunction } from './types'

/** Trường số có thể bị báo `DIMENSION_NOT_POSITIVE`: nhãn và đơn vị của số 0 trong câu. */
const POSITIVE_FIELDS = {
  innerLengthCm: { label: 'fields.innerLengthCm', unit: 'cm' },
  innerWidthCm: { label: 'fields.innerWidthCm', unit: 'cm' },
  innerHeightCm: { label: 'fields.innerHeightCm', unit: 'cm' },
  maxPayloadKg: { label: 'fields.maxPayloadKg', unit: 'kg' },
  doorWidthCm: { label: 'fields.doorWidthCm', unit: 'cm' },
  doorHeightCm: { label: 'fields.doorHeightCm', unit: 'cm' },
  lengthCm: { label: 'fields.lengthCm', unit: 'cm' },
  widthCm: { label: 'fields.widthCm', unit: 'cm' },
  heightCm: { label: 'fields.heightCm', unit: 'cm' },
} as const satisfies Record<string, { label: MessageKey; unit: 'cm' | 'kg' }>

/**
 * Câu hiển thị cho một issue của `@/domain/constraints` (D-28): domain chỉ trả mã + số thô,
 * ở đây chọn câu theo ngôn ngữ của `t` và format số theo `format`.
 *
 * Issue thiếu dữ liệu mà câu cần (mã kiện, kiện liên quan, trường) là lỗi của nơi tạo issue → `throw`,
 * không in câu thiếu chủ ngữ.
 */
export function formatIssue(issue: ConstraintIssue, t: TFunction, format: Formatter): string {
  switch (issue.code) {
    case 'DIMENSION_NOT_POSITIVE': {
      const { label, unit } = positiveFieldOf(issue)
      const words = { field: t(label), zero: unit === 'kg' ? format.weight(0) : format.length(0) }
      const { params } = issue
      if (params.entity === 'vehicle') return t('issues.DIMENSION_NOT_POSITIVE.vehicle', words)
      if (params.entity === 'obstacle') {
        return t('issues.DIMENSION_NOT_POSITIVE.obstacle', { ...words, obstacleId: params.obstacleId })
      }
      return t('issues.DIMENSION_NOT_POSITIVE.package', { ...words, packageId: params.packageId })
    }
    case 'DOOR_EXCEEDS_INNER':
      return t(`issues.DOOR_EXCEEDS_INNER.${issue.params.axis}`, {
        doorCm: format.length(issue.params.doorCm),
        innerCm: format.length(issue.params.innerCm),
      })
    case 'NO_ALLOWED_ORIENTATION':
      return t('issues.NO_ALLOWED_ORIENTATION', { packageId: issue.params.packageId })
    case 'PAYLOAD_EXCEEDED':
    case 'MUST_LOAD_PAYLOAD_EXCEEDED':
      return t(`issues.${issue.code}`, {
        totalKg: format.weight(issue.params.totalKg),
        maxPayloadKg: format.weight(issue.params.maxPayloadKg),
      })
    case 'DOOR_TOO_SMALL':
      return t('issues.DOOR_TOO_SMALL', {
        packageId: issue.params.packageId,
        door: format.widthByHeight(issue.params.doorWidthCm, issue.params.doorHeightCm),
      })
    case 'EXCEEDS_BOUNDARY':
      return t(`issues.EXCEEDS_BOUNDARY.${issue.params.axis}.${issue.params.side}`, {
        subject: subjectPhrase(issue, t),
        overCm: format.length(issue.params.overCm),
      })
    case 'OVERLAP':
    case 'NOT_STACKABLE':
    case 'LOADING_ORDER_INFEASIBLE':
      return t(`issues.${issue.code}`, { id: subjectOf(issue), related: relatedOf(issue, format) })
    case 'OBSTACLE_OVERLAP':
      return t('issues.OBSTACLE_OVERLAP', { id: placementOrObstacleOf(issue).id, obstacleId: issue.params.obstacleId })
    case 'NON_BEARING_SUPPORT':
      return t('issues.NON_BEARING_SUPPORT', { id: subjectOf(issue), obstacleId: issue.params.obstacleId })
    case 'SUPPORT_BELOW_MIN':
      return t('issues.SUPPORT_BELOW_MIN', {
        id: subjectOf(issue),
        ratio: format.ratio(issue.params.ratio),
        required: format.ratio(issue.params.required),
      })
    case 'TOP_LOAD_EXCEEDED':
      return t('issues.TOP_LOAD_EXCEEDED', {
        subject: subjectPhrase(issue, t),
        loadKg: format.weight(issue.params.loadKg),
        maxKg: format.weight(issue.params.maxKg),
      })
    case 'STACK_COUNT_EXCEEDED':
      return t('issues.STACK_COUNT_EXCEEDED', {
        id: subjectOf(issue),
        layers: format.integer(issue.params.layers),
        maxStackCount: format.integer(issue.params.maxStackCount),
      })
    case 'LIFO_BLOCKED':
      return t('issues.LIFO_BLOCKED', { id: subjectOf(issue) })
    case 'LIFO_PARTIAL':
      return t('issues.LIFO_PARTIAL', { id: subjectOf(issue), coverage: format.percent(issue.params.coverage * 100) })
    case 'COG_LATERAL':
      return t('issues.COG_LATERAL', {
        offsetCm: format.length(issue.params.offsetCm),
        limitCm: format.length(issue.params.limitCm),
      })
    case 'COG_LONGITUDINAL':
      return t(`issues.COG_LONGITUDINAL.${issue.params.toward}`, {
        offsetCm: format.length(issue.params.offsetCm),
        limitCm: format.length(issue.params.limitCm),
      })
    case 'AXLE_OVERLOAD':
      return t(`issues.AXLE_OVERLOAD.${issue.params.group}`, {
        loadKg: format.weight(issue.params.loadKg),
        limitKg: format.weight(issue.params.limitKg),
        overKg: format.weight(issue.params.overKg),
      })
    case 'COG_HIGH':
      return t('issues.COG_HIGH', {
        heightCm: format.length(issue.params.heightCm),
        limitCm: format.length(issue.params.limitCm),
      })
    case 'MUST_LOAD_UNPLACED':
      return t('issues.MUST_LOAD_UNPLACED', { packageId: issue.params.packageId })
    case 'DUPLICATE_INSTANCE_ID':
      return t('issues.DUPLICATE_INSTANCE_ID', {
        id: subjectOf(issue),
        occurrences: format.integer(issue.params.occurrences),
        related: relatedOf(issue, format),
      })
    case 'ORIENTATION_MISMATCH':
    case 'ORIENTATION_NOT_ALLOWED':
      return t(`issues.${issue.code}`, { id: subjectOf(issue), orientation: issue.params.orientation })
    case 'PINNED_INSTANCE_UNKNOWN':
      return t('issues.PINNED_INSTANCE_UNKNOWN', { id: subjectOf(issue) })
    default:
      return unreachable(issue)
  }
}

/** Thêm mã vào `CONSTRAINT_CODES` mà chưa có câu thì `tsc -b` báo lỗi ở đây. */
function unreachable(issue: never): never {
  throw new Error(`Chưa có câu cho issue ${JSON.stringify(issue)}`)
}

function subjectOf(issue: ConstraintIssue): string {
  if (issue.packageInstanceId === undefined) throw new Error(`Issue ${issue.code} thiếu packageInstanceId`)
  return issue.packageInstanceId
}

function relatedOf(issue: ConstraintIssue, format: Formatter): string {
  if (!issue.relatedIds?.length) throw new Error(`Issue ${issue.code} thiếu relatedIds`)
  return format.list(issue.relatedIds)
}

/** "Kiện PKG-004" · "Vật cản OBS-001" — chủ ngữ đứng đầu câu. */
function subjectPhrase(issue: ConstraintIssue, t: TFunction): string {
  const { kind, id } = placementOrObstacleOf(issue)
  return t(`issues.subject.${kind}`, { id })
}

/**
 * Kiện đã xếp (`packageInstanceId`), hoặc vật cản ở `relatedIds[0]` khi issue không gắn kiện (dòng vật cản của form xe
 * ở LM-017, vật cản chịu tải quá tải ở LM-019) — quy ước chủ thể của `ConstraintIssue`.
 */
function placementOrObstacleOf(issue: ConstraintIssue): { kind: 'placement' | 'obstacle'; id: string } {
  if (issue.packageInstanceId !== undefined) return { kind: 'placement', id: issue.packageInstanceId }
  const obstacleId = issue.relatedIds?.[0]
  if (obstacleId === undefined) throw new Error(`Issue ${issue.code} thiếu packageInstanceId hoặc relatedIds[0]`)
  return { kind: 'obstacle', id: obstacleId }
}

function isPositiveField(name: string): name is keyof typeof POSITIVE_FIELDS {
  return Object.hasOwn(POSITIVE_FIELDS, name)
}

/** `field` là đường dẫn form (`innerLengthCm`, `obstacles.0.lengthCm`); nhãn lấy theo đoạn cuối. */
function positiveFieldOf(issue: ConstraintIssue): (typeof POSITIVE_FIELDS)[keyof typeof POSITIVE_FIELDS] {
  const name = issue.field?.split('.').at(-1)
  if (name === undefined || !isPositiveField(name)) {
    throw new Error(`Issue ${issue.code} có trường không có nhãn: ${String(issue.field)}`)
  }
  return POSITIVE_FIELDS[name]
}
