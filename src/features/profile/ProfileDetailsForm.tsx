import { zodResolver } from '@hookform/resolvers/zod'
import { useId } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader, CardMeta, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { dataErrorMessage, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { User } from '@/types/user'
import { profileSchema, translateProfileError, type ProfileInput, type ProfileValues } from './profile-form.schema'
import { FORM_ALERT, SECTION_TEXT, TOUCH_CONTROL } from './profile-styles'
import { useSaveProfileMutation } from './useProfileMutations'

/**
 * Thông tin cá nhân (LM-096): họ tên và số điện thoại sửa được. Email, vai trò, kho trực thuộc chỉ đọc và nằm ở cột nhận diện
 * (`ProfileIdentity`), không lặp lại ở đây. Lưu xong thì form lấy giá trị kho vừa lưu (số điện thoại dạng "0901 234 567") làm
 * mốc, nút Lưu tắt tới lần sửa sau.
 */
export function ProfileDetailsForm({ user }: { user: User }) {
  const t = useT()
  const titleId = useId()
  const save = useSaveProfileMutation()
  const form = useForm<ProfileInput, unknown, ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { fullName: user.fullName, phone: user.phone },
  })
  const { errors, isDirty, isSubmitting } = form.formState

  async function handleValid(values: ProfileValues) {
    try {
      const saved = await save.mutateAsync(values)
      form.reset({ fullName: saved.fullName, phone: saved.phone })
      toast.success(t('profile.details.saved'))
    } catch {
      // Câu lỗi hiện dưới form từ `save.error`; dữ liệu đang nhập giữ nguyên
    }
  }

  return (
    <section aria-labelledby={titleId}>
      <Card>
        <CardHeader>
          <CardTitle as="h2" id={titleId}>{t('profile.details.title')}</CardTitle>
          <CardMeta className={SECTION_TEXT}>{t('profile.details.description')}</CardMeta>
        </CardHeader>

        <CardBody className="p-5">
          <form noValidate onSubmit={form.handleSubmit(handleValid)} className="flex flex-col gap-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label={t('profile.details.fullName')}
                autoComplete="name"
                className={TOUCH_CONTROL}
                error={translateProfileError(t, errors.fullName?.message)}
                {...form.register('fullName')}
              />
              <Input
                label={t('profile.details.phone')}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                className={cn('font-mono', TOUCH_CONTROL)}
                error={translateProfileError(t, errors.phone?.message)}
                {...form.register('phone')}
              />
            </div>

            {save.isError ? <p role="alert" className={FORM_ALERT}>{dataErrorMessage(save.error, t)}</p> : null}

            <div>
              {/* Nút chính duy nhất của màn (mục 5); đổi mật khẩu dùng nút phụ */}
              <Button type="submit" loading={isSubmitting} disabled={!isDirty || isSubmitting} className={TOUCH_CONTROL}>
                {t('profile.details.save')}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </section>
  )
}
