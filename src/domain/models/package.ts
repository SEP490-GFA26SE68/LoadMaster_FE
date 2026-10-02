import type { z } from 'zod'
import { gt, isUpright, ORIENTATION_CODES } from '@/domain/geometry'
import { finiteNumber, flag, listOf, nonNegative, objectOf, oneOf, positive, ratio, text } from './fields'
import { report, rule, type ModelIssueCode } from './issue-codes'

export const orientationCodeSchema = oneOf(ORIENTATION_CODES)

const fragilityLevelSchema = oneOf(['NONE', 'LOW', 'MEDIUM', 'HIGH'])

/**
 * Loại hàng của kiện theo backend (D-69, FE-3b-04). Nằm ngoài type Spec — D-04 "không thêm trường" đã bị thay: dòng kiện của chuyến
 * mang thêm trường này khi dựng từ kiện của kho kiện; mock tối ưu bỏ qua.
 */
export const HANDLING_CLASSES = ['STANDARD', 'FRAGILE', 'REFRIGERATED', 'HAZARDOUS', 'HIGH_VALUE'] as const
const handlingClassSchema = oneOf(HANDLING_CLASSES)

const dimensionCm =positive('package.dimension.positive')

/** Số đếm nguyên bắt đầu từ 1 (số kiện, số tầng, điểm giao). */
function countFromOne(integerCode: ModelIssueCode, minCode: ModelIssueCode) {
  return finiteNumber().int(rule(integerCode)).min(1, rule(minCode))
}

export const cargoPackageSchema = objectOf({
  id: text(),
  name: text(),
  lengthCm: dimensionCm,
  widthCm: dimensionCm,
  heightCm: dimensionCm,
  weightKg: nonNegative('package.weightKg.nonNegative'),
  quantity: countFromOne('package.quantity.integer', 'package.quantity.min'),
  allowedOrientations: listOf(orientationCodeSchema)
    .min(1, rule('package.allowedOrientations.empty'))
    .superRefine((codes, ctx) => {
      codes.forEach((code, index) => {
        if (codes.indexOf(code) !== index) report(ctx, 'package.allowedOrientations.duplicate', [index])
      })
    }),
  keepUpright: flag(),
  fragilityLevel: fragilityLevelSchema,
  stackable: flag(),
  maxTopLoadKg: nonNegative('package.maxTopLoadKg.nonNegative'),
  maxStackCount: countFromOne('package.maxStackCount.integer', 'package.maxStackCount.min').optional(),
  minSupportRatio: ratio('package.minSupportRatio.range'),
  deliveryStop: countFromOne('package.deliveryStop.integer', 'package.deliveryStop.min'),
  priority: finiteNumber(),
  mustLoad: flag(),
  groupId: text().optional(),
  notes: text().optional(),
  handlingClass: handlingClassSchema.optional(),
}).superRefine((pkg, ctx) => {
  // D-25: schema từ chối dữ liệu xung đột; tự đồng bộ là việc của form (LM-045)
  if (pkg.keepUpright) {
    pkg.allowedOrientations.forEach((code, index) => {
      if (!isUpright(code)) report(ctx, 'package.keepUpright.orientation', ['allowedOrientations', index])
    })
  }
  if (!pkg.stackable && gt(pkg.maxTopLoadKg, 0)) report(ctx, 'package.maxTopLoadKg.notStackable', ['maxTopLoadKg'])
})

export type OrientationCode = z.infer<typeof orientationCodeSchema>
export type FragilityLevel = z.infer<typeof fragilityLevelSchema>
export type HandlingClass = z.infer<typeof handlingClassSchema>
export type CargoPackage = z.infer<typeof cargoPackageSchema>
