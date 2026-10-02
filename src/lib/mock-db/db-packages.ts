import { gt, roundCm, roundKg } from '@/domain/geometry'
import { HANDLING_CLASSES } from '@/domain/models'
import { nextId, optionalText, put, type DbContext } from './db-context'
import type { Review1Db } from './db-api-review1'
import { MockDbError } from './errors'
import { canTransitionPackage, type Package, type PackageChanges, type PackageFlag, type PackageInput, type PackageSource, type PackageStatus } from './package-model'
import { normalizeQrToken } from './qr-token'

type PackageMethods = Pick<
  Review1Db,
  | 'listPackages' | 'getPackage' | 'findPackageByQr' | 'createPackage' | 'createPackages' | 'updatePackage' | 'updatePackageStatus'
  | 'flagPackage' | 'clearPackageFlag'
>

/** Giới hạn một lần tạo (một file nhập). */
export const MAX_PACKAGES_PER_CREATE = 1000

const SIZE_FIELDS = ['lengthCm', 'widthCm', 'heightCm', 'weightKg'] as const

/** Trường của kiện đã làm tròn tại biên (D-03); trường sai: `PACKAGE_INVALID` kèm tên trường đầu tiên sai. */
function packageFields(input: PackageInput): Omit<PackageInput, 'packageCode' | 'packageTypeId'> {
  for (const field of SIZE_FIELDS) {
    if (!Number.isFinite(input[field]) || !gt(input[field], 0)) throw new MockDbError('PACKAGE_INVALID', { field })
  }
  if (!HANDLING_CLASSES.includes(input.handlingClass)) throw new MockDbError('PACKAGE_INVALID', { field: 'handlingClass' })
  const destination = input.destination.trim()
  if (destination === '') throw new MockDbError('PACKAGE_INVALID', { field: 'destination' })
  return {
    lengthCm: roundCm(input.lengthCm),
    widthCm: roundCm(input.widthCm),
    heightCm: roundCm(input.heightCm),
    weightKg: roundKg(input.weightKg),
    handlingClass: input.handlingClass,
    destination,
  }
}

/**
 * Chuyển trạng thái một kiện theo bảng `PACKAGE_TRANSITIONS` — nơi **duy nhất** trong kho đổi `status`. Sai bảng:
 * `INVALID_PACKAGE_STATUS_TRANSITION`. `patch` ghi cùng lúc (chuyến, điểm giao, cờ); về `IMPORTED` thì kiện rời chuyến.
 */
export function movePackage(ctx: DbContext, pkg: Package, to: PackageStatus, patch: Partial<Package> = {}): Package {
  if (!canTransitionPackage(pkg.status, to)) throw new MockDbError('INVALID_PACKAGE_STATUS_TRANSITION', { packageId: pkg.id, from: pkg.status, to })
  const next: Package = { ...pkg, ...patch, status: to }
  if (to === 'IMPORTED') {
    delete next.tripId
    delete next.stopId
  }
  return put(ctx.state.packages, next)
}

/**
 * Kho kiện (FE-3b-01): tạo một / nhiều kiện, sửa, chuyển trạng thái, gắn và gỡ cờ. Kiện thuộc công ty của người tạo và chỉ công ty đó
 * đọc được, kể cả khi tra bằng mã QR (D-64); loại kiện của kiện phải cùng công ty. Mã QR cấp một lần lúc tạo.
 */
export function packageMethods(ctx: DbContext): PackageMethods {
  const { state } = ctx
  const { packages } = state
  const scope = ctx.scope.packages

  function create(rows: readonly PackageInput[], source: PackageSource): Package[] {
    const companyId = ctx.scope.newRecordCompany()
    if (rows.length === 0) throw new MockDbError('PACKAGES_REQUIRED', {})
    if (rows.length > MAX_PACKAGES_PER_CREATE) throw new MockDbError('QUANTITY_INVALID', { min: 1, max: MAX_PACKAGES_PER_CREATE })
    // Kiểm hết trước khi ghi: một dòng sai thì không dòng nào được ghi
    const checked = rows.map((row) => {
      if (row.packageTypeId !== undefined) ctx.scope.packageTypes.ref(row.packageTypeId, companyId)
      return { fields: packageFields(row), packageCode: optionalText(row.packageCode), packageTypeId: row.packageTypeId }
    })
    const at = ctx.nowIso()
    const created = checked.map(({ fields, packageCode, packageTypeId }) => {
      const id = nextId('PK', packages.keys(), 4)
      return put(packages, {
        id, companyId, packageCode: packageCode ?? id, qrToken: ctx.newQrToken(), ...fields,
        ...(packageTypeId === undefined ? {} : { packageTypeId }),
        status: 'IMPORTED', flags: [], source, createdAt: at, createdBy: state.session.userId,
      })
    })
    const types = [...new Set(checked.flatMap((row) => row.packageTypeId ?? []))]
    ctx.log('package.registered', { type: 'package', id: created[0]?.id ?? '' }, {
      count: created.length,
      ...(types.length > 0 ? { packageTypeId: types.join(',') } : {}),
      ...(created.length > 1 ? { lastPackageId: created.at(-1)?.id ?? '' } : {}),
    })
    return created
  }

  /** Gỡ cờ là việc của điều phối viên (D-92); kho không có phiên (test logic kho) thì không xét vai trò. */
  function assertDispatcher() {
    const user = state.session.userId === null ? undefined : state.users.get(state.session.userId)
    if (user !== undefined && user.role !== 'dispatcher') throw new MockDbError('ROLE_NOT_ALLOWED', { role: user.role })
  }

  return {
    listPackages: () => ctx.respond(() => scope.list()),
    getPackage: (id) => ctx.respond(() => scope.read(id)),
    findPackageByQr: (token) =>
      ctx.respond(() => {
        const wanted = normalizeQrToken(token)
        // Mã của kiện công ty khác cũng là "không khớp kiện nào": không lộ là mã đó có thật
        const pkg = scope.list().find((item) => item.qrToken === wanted)
        if (!pkg) throw new MockDbError('QR_UNKNOWN', { token: wanted })
        return pkg
      }),
    createPackage: (input) => ctx.respond(() => create([input], 'MANUAL')[0] as Package),
    createPackages: (rows, source = 'MANUAL') => ctx.respond(() => create(rows, source)),
    updatePackage: (id, changes: PackageChanges) =>
      ctx.respond(() => {
        const current = scope.own(id)
        if (current.status !== 'IMPORTED') throw new MockDbError('PACKAGE_UNAVAILABLE', { packageId: id, status: current.status })
        const { packageTypeId: currentType, ...rest } = current
        const { packageTypeId: requestedType, ...fieldChanges } = changes
        const packageTypeId = requestedType === undefined ? currentType : (requestedType ?? undefined)
        if (packageTypeId !== undefined) ctx.scope.packageTypes.ref(packageTypeId, current.companyId)
        const fields = packageFields({ ...rest, ...fieldChanges })
        const packageCode = changes.packageCode === undefined ? current.packageCode : (optionalText(changes.packageCode) ?? id)
        ctx.log('package.updated', { type: 'package', id }, { packageCode })
        return put(packages, { ...rest, ...fields, packageCode, ...(packageTypeId === undefined ? {} : { packageTypeId }) })
      }),
    updatePackageStatus: (id, status) =>
      ctx.respond(() => {
        const current = scope.own(id)
        const next = movePackage(ctx, current, status)
        ctx.log('package.statusChanged', { type: 'package', id }, { before: current.status, after: status })
        return next
      }),
    flagPackage: (id, flag: PackageFlag) =>
      ctx.respond(() => {
        const current = scope.own(id)
        if (current.status !== 'IMPORTED') throw new MockDbError('PACKAGE_UNAVAILABLE', { packageId: id, status: current.status })
        if (current.flags.includes(flag)) return current
        ctx.log('package.flagged', { type: 'package', id }, { flag })
        return put(packages, { ...current, flags: [...current.flags, flag] })
      }),
    clearPackageFlag: (id, flag: PackageFlag) =>
      ctx.respond(() => {
        const current = scope.own(id)
        assertDispatcher()
        if (!current.flags.includes(flag)) throw new MockDbError('PACKAGE_FLAG_NOT_SET', { packageId: id, flag })
        ctx.log('package.flagCleared', { type: 'package', id }, { flag })
        return put(packages, { ...current, flags: current.flags.filter((item) => item !== flag) })
      }),
  }
}
