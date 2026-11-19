import { z } from 'zod'
import type { TFunction } from '@/lib/i18n'
import { REQUIREMENT_PRIORITIES, type DeliveryRequirement } from '@/lib/mock-db'
import { MAX_ADDRESS, MAX_NAME, MAX_NOTE, validateRequirement, type RequirementFieldError, type RequirementFormValues } from './requirement-form'

/**
 * Schema zod của form yêu cầu giao (máy chủ, `RequirementFormDialog`): luật nằm ở `validateRequirement` (thuần, trả mã), schema chỉ gắn
 * câu lỗi đã dịch vào đúng ô.
 */

const MAX_OF: Partial<Record<keyof RequirementFormValues, number>> = {
  destinationName: MAX_NAME,
  address: MAX_ADDRESS,
  note: MAX_NOTE,
}

function errorText(field: keyof RequirementFormValues, code: RequirementFieldError, t: TFunction): string {
  if (code === 'tooLong') return t('requirements.form.errors.tooLong', { max: MAX_OF[field] ?? MAX_NOTE })
  if (code === 'invalidCount') return t('requirements.form.errors.invalidCount')
  if (code === 'coordinatesInvalid') return t('requirements.form.errors.coordinatesInvalid')
  if (code === 'deadlineInvalid' || code === 'deadlinePast') return t(`requirements.form.errors.${code}`)
  if (field === 'customerId') return t('requirements.form.errors.customerRequired')
  if (field === 'expectedPackageCount') return t('requirements.form.errors.invalidCount')
  if (field === 'destinationName') return t('requirements.form.errors.destinationRequired')
  if (field === 'address') return t('requirements.form.errors.addressRequired')
  if (field === 'deadlineDate') return t('requirements.form.errors.deadlineDateRequired')
  if (field === 'deadlineTime') return t('requirements.form.errors.deadlineTimeRequired')
  return t('requirements.form.errors.priorityRequired')
}

export function requirementSchema(t: TFunction, original?: DeliveryRequirement) {
  return z
    .object({
      customerId: z.string(),
      expectedPackageCount: z.string(),
      destinationName: z.string(),
      address: z.string(),
      deadlineDate: z.string(),
      deadlineTime: z.string(),
      priority: z.enum(REQUIREMENT_PRIORITIES),
      packageIds: z.array(z.string()),
      note: z.string(),
      coordinates: z.object({ lat: z.string(), lng: z.string() }),
    })
    .superRefine((values, ctx) => {
      const errors = validateRequirement(values, new Date(), original)
      for (const field of Object.keys(errors) as (keyof RequirementFormValues)[]) {
        const code = errors[field]
        if (code) ctx.addIssue({ code: 'custom', path: [field], message: errorText(field, code, t) })
      }
    })
}
