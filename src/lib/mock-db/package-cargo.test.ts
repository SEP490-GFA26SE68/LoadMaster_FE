import { expect, test } from 'vitest'
import { cargoPackageSchema, type HandlingClass } from '@/domain/models'
import { cargoFromPackage, type Package, type PackageType } from '@/lib/mock-db'

/** Ràng buộc xếp của kiện kho kiện (FE-3b-04, D-69): có loại kiện thì theo loại kiện, không thì mặc định theo loại hàng. */

const pkg = (handlingClass: HandlingClass, extra: Partial<Package> = {}): Package => ({
  id: 'PK-0100', companyId: 'LOG-001', packageCode: 'DN-0100', qrToken: 'LM-0000-0000-0001', lengthCm: 60, widthCm: 40, heightCm: 35,
  weightKg: 12.5, handlingClass, destination: 'Đà Nẵng', status: 'IMPORTED', flags: [], source: 'IMPORT', createdAt: '2026-09-14T01:00:00.000Z',
  createdBy: 'US-0001', history: [], ...extra,
})

const fan: PackageType = {
  id: 'PT-006', companyId: 'LOG-001', name: 'Quạt điện đứng', lengthCm: 45, widthCm: 45, heightCm: 20, weightKg: 6, fragilityLevel: 'MEDIUM',
  allowedOrientations: ['LWH'], keepUpright: true, stackable: true, maxStackCount: 3, maxTopLoadKg: 12, createdAt: '2026-08-15T02:00:00.000Z',
}

test('a fragile package without a package type lets nothing rest on it', () => {
  expect(cargoFromPackage(pkg('FRAGILE'))).toStrictEqual({
    id: 'PK-0100', name: 'DN-0100', lengthCm: 60, widthCm: 40, heightCm: 35, weightKg: 12.5, quantity: 1, allowedOrientations: ['LWH', 'WLH'],
    keepUpright: true, fragilityLevel: 'HIGH', stackable: false, maxTopLoadKg: 0, minSupportRatio: 0.8, deliveryStop: 1, priority: 1, mustLoad: true,
    handlingClass: 'FRAGILE',
  })
})

test.each<HandlingClass>(['STANDARD', 'REFRIGERATED', 'HAZARDOUS', 'HIGH_VALUE'])('a %s package without a package type stacks like ordinary goods', (handlingClass) => {
  // Mặc định chịu ba kiện như nó: 12,5 kg × 3
  expect(cargoFromPackage(pkg(handlingClass))).toStrictEqual({
    id: 'PK-0100', name: 'DN-0100', lengthCm: 60, widthCm: 40, heightCm: 35, weightKg: 12.5, quantity: 1, allowedOrientations: ['LWH', 'WLH'],
    keepUpright: true, fragilityLevel: 'NONE', stackable: true, maxTopLoadKg: 37.5, minSupportRatio: 0.8, deliveryStop: 1, priority: 1, mustLoad: true,
    handlingClass,
  })
})

test.each<HandlingClass>(['STANDARD', 'FRAGILE', 'REFRIGERATED', 'HAZARDOUS', 'HIGH_VALUE'])('a %s package with a package type takes orientations, stacking and top load from the type, sizes from itself', (handlingClass) => {
  const cargo = cargoFromPackage(pkg(handlingClass, { packageTypeId: 'PT-006' }), fan, { id: 'PKG-004', quantity: 6, deliveryStop: 2, groupId: 'REQ-007' })
  expect(cargo).toStrictEqual({
    id: 'PKG-004', name: 'Quạt điện đứng', lengthCm: 60, widthCm: 40, heightCm: 35, weightKg: 12.5, quantity: 6, allowedOrientations: ['LWH'],
    keepUpright: true, fragilityLevel: 'MEDIUM', stackable: true, maxTopLoadKg: 12, maxStackCount: 3, minSupportRatio: 0.8, deliveryStop: 2, priority: 1,
    mustLoad: true, groupId: 'REQ-007', handlingClass,
  })
})

test('every mapping is a valid Spec package, with or without a type', () => {
  for (const handlingClass of ['STANDARD', 'FRAGILE', 'REFRIGERATED', 'HAZARDOUS', 'HIGH_VALUE'] as const) {
    expect(cargoPackageSchema.safeParse(cargoFromPackage(pkg(handlingClass))).success).toBe(true)
    expect(cargoPackageSchema.safeParse(cargoFromPackage(pkg(handlingClass), fan)).success).toBe(true)
  }
})
