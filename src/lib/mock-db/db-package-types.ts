import { found, nextId, put, type DbContext } from './db-context'
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

/** Công ty và danh mục loại kiện (luồng 1, LM-104). */
export function packageTypeMethods(ctx: DbContext): PackageTypeMethods {
  const { companies, packageTypes, registeredPackages } = ctx.state
  return {
    listCompanies: () => ctx.respond(() => [...companies.values()]),
    listPackageTypes: () => ctx.respond(() => [...packageTypes.values()]),
    getPackageType: (id) => ctx.respond(() => found(packageTypes, 'packageTypes', id)),
    createPackageType: (input) =>
      ctx.respond(() => {
        const fields = typeFields(input)
        assertValid(fields)
        const created = put(packageTypes, { ...fields, id: nextId('PT', packageTypes.keys()), createdAt: ctx.nowIso() })
        ctx.log('packageType.created', { type: 'packageType', id: created.id }, { name: created.name })
        return created
      }),
    updatePackageType: (id, input) =>
      ctx.respond(() => {
        const current = found(packageTypes, 'packageTypes', id)
        const fields = typeFields(input)
        assertValid(fields)
        const next: PackageType = { ...fields, id, createdAt: current.createdAt }
        ctx.log('packageType.updated', { type: 'packageType', id }, { name: next.name })
        return put(packageTypes, next)
      }),
    deletePackageType: (id) =>
      ctx.respond(() => {
        const current = found(packageTypes, 'packageTypes', id)
        const count = [...registeredPackages.values()].filter((pkg) => pkg.packageTypeId === id).length
        if (count > 0) throw new MockDbError('PACKAGE_TYPE_IN_USE', { packageTypeId: id, count })
        packageTypes.delete(id)
        ctx.log('packageType.deleted', { type: 'packageType', id }, { name: current.name })
      }),
  }
}
