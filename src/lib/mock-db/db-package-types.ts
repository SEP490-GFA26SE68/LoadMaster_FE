import { nextId, put, type DbContext } from './db-context'
import type { Review1Db } from './db-api-review1'
import { MockDbError } from './errors'
import { packageTypeIssues } from './package-type-cargo'
import type { PackageType, PackageTypeInput } from './source-types'

type PackageTypeMethods = Pick<
  Review1Db,
  'listCompanies' | 'listPackageTypes' | 'getPackageType' | 'createPackageType' | 'updatePackageType' | 'deletePackageType'
>

/** Chỉ các trường của loại kiện: trường lạ trong đầu vào (mã, thời điểm tạo của bản sao cũ) không được ghi. */
function typeFields(input: PackageTypeInput): PackageTypeInput {
  return {
    name: input.name.trim(),
    lengthCm: input.lengthCm,
    widthCm: input.widthCm,
    heightCm: input.heightCm,
    weightKg: input.weightKg,
    fragilityLevel: input.fragilityLevel,
    allowedOrientations: [...input.allowedOrientations],
    keepUpright: input.keepUpright,
    stackable: input.stackable,
    maxTopLoadKg: input.maxTopLoadKg,
    ...(input.maxStackCount === undefined ? {} : { maxStackCount: input.maxStackCount }),
  }
}

function assertValid(input: PackageTypeInput) {
  const codes = packageTypeIssues(input)
  if (codes.length > 0) throw new MockDbError('PACKAGE_TYPE_INVALID', { codes })
}

/** Công ty và danh mục loại kiện (luồng 1, LM-104). Mỗi công ty một danh mục loại kiện riêng (D-64). */
export function packageTypeMethods(ctx: DbContext): PackageTypeMethods {
  const { packageTypes, registeredPackages } = ctx.state
  const scope = ctx.scope.packageTypes
  return {
    listCompanies: () => ctx.respond(() => ctx.scope.companies.list()),
    listPackageTypes: () => ctx.respond(() => scope.list()),
    getPackageType: (id) => ctx.respond(() => scope.read(id)),
    createPackageType: (input) =>
      ctx.respond(() => {
        const companyId = ctx.scope.newRecordCompany()
        const fields = typeFields(input)
        assertValid(fields)
        const created = put(packageTypes, { ...fields, id: nextId('PT', packageTypes.keys()), companyId, createdAt: ctx.nowIso() })
        ctx.log('packageType.created', { type: 'packageType', id: created.id }, { name: created.name })
        return created
      }),
    updatePackageType: (id, input) =>
      ctx.respond(() => {
        const current = scope.own(id)
        const fields = typeFields(input)
        assertValid(fields)
        const next: PackageType = { ...fields, id, companyId: current.companyId, createdAt: current.createdAt }
        ctx.log('packageType.updated', { type: 'packageType', id }, { name: next.name })
        return put(packageTypes, next)
      }),
    deletePackageType: (id) =>
      ctx.respond(() => {
        const current = scope.own(id)
        const count = [...registeredPackages.values()].filter((pkg) => pkg.packageTypeId === id).length
        if (count > 0) throw new MockDbError('PACKAGE_TYPE_IN_USE', { packageTypeId: id, count })
        packageTypes.delete(id)
        ctx.log('packageType.deleted', { type: 'packageType', id }, { name: current.name })
      }),
  }
}
