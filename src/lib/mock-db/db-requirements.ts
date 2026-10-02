import { found, nextId, optionalText, put, sameData, type DbContext } from './db-context'
import type { Review1Db } from './db-api-review1'
import { requirementTripMethods, syncRequirementOnTrip } from './db-requirement-trips'
import { MockDbError } from './errors'
import type { Package } from './package-model'
import {
  isRequirementClosed,
  isValidCoordinate,
  REQUIREMENT_FIELDS_AFTER_PENDING,
  REQUIREMENT_PRIORITIES,
  type DeliveryRequirement,
  type RequirementChanges,
  type RequirementInput,
} from './requirement-model'

type RequirementMethods = Pick<
  Review1Db,
  | 'listDeliveryRequirements' | 'getDeliveryRequirement' | 'createDeliveryRequirement' | 'updateDeliveryRequirement' | 'deleteDeliveryRequirement'
  | 'assignDeliveryRequirement' | 'unassignDeliveryRequirement'
>

type Fields = Pick<DeliveryRequirement, 'destinationName' | 'address' | 'lat' | 'lng' | 'deadline' | 'priority' | 'note'>

const FIELD_NAMES = ['destinationName', 'address', 'lat', 'lng', 'deadline', 'priority', 'note'] as const satisfies readonly (keyof Fields)[]

const invalid = (field: string) => new MockDbError('REQUIREMENT_INVALID', { field })

/**
 * Trường của yêu cầu đã chuẩn hoá: chữ bỏ khoảng trắng hai đầu, ghi chú trống thì bỏ hẳn, hạn thành ISO 8601 (UTC). Toạ độ có cả hai
 * hoặc không có cái nào. Trường sai: `REQUIREMENT_INVALID` kèm tên trường đầu tiên sai.
 */
function requirementFields(input: Omit<RequirementInput, 'packageIds'>): Fields {
  const destinationName = input.destinationName.trim()
  if (destinationName === '') throw invalid('destinationName')
  const address = input.address.trim()
  if (address === '') throw invalid('address')
  if (!REQUIREMENT_PRIORITIES.includes(input.priority)) throw invalid('priority')
  const deadlineMs = Date.parse(input.deadline)
  if (Number.isNaN(deadlineMs)) throw invalid('deadline')
  const hasCoordinates = input.lat !== undefined || input.lng !== undefined
  if (hasCoordinates && (input.lat === undefined || input.lng === undefined || !isValidCoordinate(input.lat, input.lng))) throw invalid('coordinates')
  const note = optionalText(input.note)
  return {
    destinationName,
    address,
    ...(input.lat === undefined || input.lng === undefined ? {} : { lat: input.lat, lng: input.lng }),
    deadline: new Date(deadlineMs).toISOString(),
    priority: input.priority,
    ...(note === undefined ? {} : { note }),
  }
}

/**
 * Yêu cầu giao (FE-4b-01, D-72): tạo, sửa, xoá; đưa vào chuyến và gỡ khỏi chuyến ở `db-requirement-trips.ts`. Yêu cầu, kiện của nó và
 * chuyến chở nó cùng một công ty (D-64). Kho không xét vai trò: quyền `requirements.edit` (quản lý công ty) chặn ở giao diện, backend
 * thật kiểm lại ở server.
 */
export function requirementMethods(ctx: DbContext): RequirementMethods {
  const { requirements, packages } = ctx.state
  const scope = ctx.scope.requirements

  const membersOf = (requirement: DeliveryRequirement): Package[] => requirement.packageIds.map((id) => found(packages, 'packages', id))

  /** Hạn phải ở tương lai theo đồng hồ của kho. */
  function assertFuture(deadline: string) {
    if (Date.parse(deadline) <= Date.parse(ctx.nowIso())) throw new MockDbError('REQUIREMENT_DEADLINE_PAST', { deadline })
  }

  /**
   * Kiện của yêu cầu `requirementId` (công ty `companyId`): cùng công ty, còn ở kho kiện (`IMPORTED`), không cờ (D-92), chưa thuộc yêu
   * cầu khác.
   */
  function assertPackages(packageIds: readonly string[], requirementId: string, companyId: string) {
    if (packageIds.length === 0) throw new MockDbError('PACKAGES_REQUIRED', {})
    for (const id of packageIds) {
      const pkg = ctx.scope.packages.ref(id, companyId)
      const flag = pkg.flags[0]
      if (flag !== undefined) throw new MockDbError('PACKAGE_FLAGGED', { packageId: id, flag })
      const taken = pkg.requirementId !== undefined && pkg.requirementId !== requirementId
      if (pkg.status !== 'IMPORTED' || taken) throw new MockDbError('PACKAGE_UNAVAILABLE', { packageId: id, status: pkg.status })
    }
  }

  function linkPackages(requirementId: string, before: readonly string[], after: readonly string[]) {
    for (const id of before) {
      const pkg = packages.get(id)
      if (pkg && !after.includes(id)) {
        const { requirementId: _dropped, ...rest } = pkg
        put(packages, rest)
      }
    }
    for (const id of after) {
      const pkg = packages.get(id)
      if (pkg) put(packages, { ...pkg, requirementId })
    }
  }

  return {
    listDeliveryRequirements: () => ctx.respond(() => scope.list().toReversed()),
    getDeliveryRequirement: (id) => ctx.respond(() => scope.read(id)),
    createDeliveryRequirement: (input) =>
      ctx.respond(() => {
        const companyId = ctx.scope.newRecordCompany()
        const fields = requirementFields(input)
        assertFuture(fields.deadline)
        const id = nextId('REQ', requirements.keys())
        const packageIds = [...new Set(input.packageIds)]
        assertPackages(packageIds, id, companyId)
        const requirement = put(requirements, { id, companyId, ...fields, packageIds, status: 'PENDING', createdAt: ctx.nowIso(), createdBy: ctx.state.session.userId })
        linkPackages(id, [], packageIds)
        ctx.log('requirement.created', { type: 'requirement', id }, { destinationName: fields.destinationName, count: packageIds.length, priority: fields.priority })
        return requirement
      }),
    updateDeliveryRequirement: (id, changes: RequirementChanges) =>
      ctx.respond(() => {
        const current = scope.own(id)
        if (isRequirementClosed(current, membersOf(current))) throw new MockDbError('REQUIREMENT_STATUS_INVALID', { requirementId: id, status: current.status })
        const { lat, lng, packageIds: requestedIds, ...rest } = changes
        // Trường vắng (`undefined`) giữ giá trị đang có
        const given = Object.fromEntries(Object.entries(rest).filter(([, value]) => value !== undefined))
        const fields = requirementFields({
          ...current,
          ...given,
          lat: lat === undefined ? current.lat : (lat ?? undefined),
          lng: lng === undefined ? current.lng : (lng ?? undefined),
        })
        const packageIds = requestedIds === undefined ? current.packageIds : [...new Set(requestedIds)]
        const changed: string[] = FIELD_NAMES.filter((field) => !sameData(fields[field], current[field]))
        if (!sameData(packageIds, current.packageIds)) changed.push('packageIds')
        if (changed.length === 0) return current
        const open: readonly string[] = REQUIREMENT_FIELDS_AFTER_PENDING
        if (current.status !== 'PENDING' && changed.some((field) => !open.includes(field))) {
          throw new MockDbError('REQUIREMENT_NOT_PENDING', { requirementId: id, status: current.status })
        }
        if (changed.includes('deadline')) assertFuture(fields.deadline)
        if (changed.includes('packageIds')) assertPackages(packageIds, id, current.companyId)
        const { lat: _lat, lng: _lng, note: _note, ...kept } = current
        const next = put(requirements, { ...kept, ...fields, packageIds })
        linkPackages(id, current.packageIds, packageIds)
        if (changed.includes('priority') || changed.includes('deadline')) syncRequirementOnTrip(ctx, next, changed.includes('priority'))
        ctx.log('requirement.updated', { type: 'requirement', id }, { destinationName: next.destinationName, fields: changed.join(',') })
        return next
      }),
    deleteDeliveryRequirement: (id) =>
      ctx.respond(() => {
        const current = scope.own(id)
        if (current.status !== 'PENDING') throw new MockDbError('REQUIREMENT_NOT_PENDING', { requirementId: id, status: current.status })
        linkPackages(id, current.packageIds, [])
        // Ghi trước khi xoá: nhật ký giữ tên điểm đến của yêu cầu không còn trong kho
        ctx.log('requirement.deleted', { type: 'requirement', id }, { destinationName: current.destinationName, count: current.packageIds.length })
        requirements.delete(id)
      }),
    ...requirementTripMethods(ctx),
  }
}
