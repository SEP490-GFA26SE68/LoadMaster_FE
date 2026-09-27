import { z } from 'zod'
import type { TFunction } from '@/lib/i18n'
import type { PackageType, RegisteredPackage } from '@/lib/mock-db'

/**
 * Form tạo / sửa lô nháp (LM-104). Message dịch sẵn khi dựng schema (`SelectField` in thẳng message); nhà sản xuất tạo lô cho công ty
 * mình, vai trò khác (quản trị viên) chọn công ty — `needManufacturer`.
 */
export function shipmentFormSchema(needManufacturer: boolean, t: TFunction) {
  return z.object({
    manufacturerId: needManufacturer ? z.string().min(1, t('sourcing.register.errors.companyRequired')) : z.string(),
    logisticsCompanyId: z.string().min(1, t('sourcing.shipments.form.logisticsRequired')),
    packageIds: z.array(z.string()).min(1, t('sourcing.shipments.form.packagesRequired')),
    note: z.string().trim().max(200),
  })
}

export type ShipmentFormValues = z.output<ReturnType<typeof shipmentFormSchema>>

/** Một nhóm kiện cùng loại trong ô chọn kiện. */
export type PackageGroup = { readonly typeId: string; readonly type: PackageType | undefined; readonly packages: readonly RegisteredPackage[] }

/** Nhóm kiện theo loại, giữ thứ tự xuất hiện; mã kiện trong nhóm tăng dần. */
export function groupByType(packages: readonly RegisteredPackage[], types: readonly PackageType[]): PackageGroup[] {
  const typeById = new Map(types.map((type) => [type.id, type]))
  const groups = new Map<string, RegisteredPackage[]>()
  for (const pkg of packages) groups.set(pkg.packageTypeId, [...(groups.get(pkg.packageTypeId) ?? []), pkg])
  return [...groups].map(([typeId, items]) => ({
    typeId,
    type: typeById.get(typeId),
    packages: items.toSorted((a, b) => a.id.localeCompare(b.id)),
  }))
}
