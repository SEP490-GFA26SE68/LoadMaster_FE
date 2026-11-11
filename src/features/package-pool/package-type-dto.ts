import { roundCm, roundKg } from '@/domain/geometry'
import { specFieldsOf, type PackageType } from '@/lib/mock-db'

/**
 * DTO loại kiện của backend (`PackageTypeResponse`) và phép đổi sang kiểu của app. Chỉ các file `-api` của kho kiện import file này.
 * Kích thước của backend là số nguyên cm (D-03). Backend không có mức dễ vỡ, giữ thẳng đứng hay số tầng của Spec: ba trường giới hạn
 * (`maxStackingWeightKg`, `rotationAllowed`, `isFragile`) đổi sang trường Spec qua `specFieldsOf`, không giữ thẳng đứng.
 */
export type BackendPackageType = {
  readonly id: number
  readonly companyId?: number | null
  readonly typeCode?: string | null
  readonly name: string
  readonly length?: number | null
  readonly width?: number | null
  readonly height?: number | null
  readonly weightKg?: number | string | null
  readonly maxStackingWeightKg?: number | string | null
  readonly isFragile?: boolean | null
  readonly rotationAllowed?: boolean | null
}

const cm = (value: number | null | undefined) => roundCm(Number(value ?? 0))
const kg = (value: number | string | null | undefined) => roundKg(Number(value ?? 0))

export function packageTypeOf(dto: BackendPackageType): PackageType {
  const limits = {
    maxStackWeightKg: kg(dto.maxStackingWeightKg),
    rotationAllowed: dto.rotationAllowed === true,
    fragile: dto.isFragile === true,
  }
  return {
    id: String(dto.id),
    companyId: dto.companyId == null ? '' : String(dto.companyId),
    name: dto.name,
    lengthCm: cm(dto.length),
    widthCm: cm(dto.width),
    heightCm: cm(dto.height),
    weightKg: kg(dto.weightKg),
    keepUpright: false,
    createdAt: '',
    ...limits,
    ...specFieldsOf(limits, { keepUpright: false }),
  }
}
