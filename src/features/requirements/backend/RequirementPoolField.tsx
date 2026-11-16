import { Controller, type Control } from 'react-hook-form'
import { Banner } from '@/components/Banner'
import { Spinner } from '@/components/ui/Spinner'
import { dataErrorMessage, useT } from '@/lib/i18n'
import { RequirementPackagePicker } from '../RequirementPackagePicker'
import type { RequirementFormValues } from './requirement-form'
import { useRequirementPackageChoicesQuery } from './useRequirementsQuery'

/**
 * Ô chọn kiện của form yêu cầu giao khi đọc ghi máy chủ: kiện đang chờ ở kho kiện, không mang cờ, chưa thuộc yêu cầu nào (kiện của chính
 * yêu cầu đang sửa vẫn hiện). Dùng lại ô chọn kiện của kho mẫu, mã hiện là mã của bên gửi.
 */
export function RequirementPoolField({ control, requirementId }: {
  control: Control<RequirementFormValues>
  requirementId: string | undefined
}) {
  const t = useT()
  const choices = useRequirementPackageChoicesQuery(requirementId)

  if (choices.isPending) {
    return (
      <div role="status" aria-label={t('requirements.form.packagesLoading')} className="flex justify-center py-4">
        <Spinner />
      </div>
    )
  }
  if (choices.isError) return <Banner tone="danger">{dataErrorMessage(choices.error, t)}</Banner>

  return (
    <Controller
      control={control}
      name="packageIds"
      render={({ field, fieldState }) => (
        <RequirementPackagePicker
          packages={choices.data}
          value={field.value}
          onChange={field.onChange}
          error={fieldState.error?.message}
          codeOf={(pkg) => pkg.packageCode}
        />
      )}
    />
  )
}
