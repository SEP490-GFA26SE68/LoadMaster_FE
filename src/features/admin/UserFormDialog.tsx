import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Button } from '@/components/ui/Button'
import type { CompanyOption } from './users-api'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { SelectField } from '@/components/ui/SelectField'
import { dataErrorMessage, useT } from '@/lib/i18n'
import type { UserScope } from '@/lib/mock-db'
import type { Role, User } from '@/types/user'
import type { AccountBlock } from './account-guards'
import {
  translateUserFormError,
  userFormSchema,
  type UserFormInput,
  type UserFormValues,
} from './user-form.schema'

/** Vai trò chọn sẵn của form thêm mới, theo phạm vi của người quản trị. */
const DEFAULT_ROLE: Record<UserScope, Role> = { platform: 'systemSupporter', company: 'dispatcher' }

function emptyValues(scope: UserScope): UserFormInput {
  return {
    fullName: '',
    email: '',
    phone: '',
    role: DEFAULT_ROLE[scope],
    depot: '',
    companyId: '',
  }
}

function toFormValues(user: User): UserFormInput {
  return {
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    depot: user.depot ?? '',
    companyId: user.companyId ?? '',
  }
}



/**
 * Thêm hoặc sửa người dùng. Truyền `user` để sửa, bỏ trống để thêm mới. Nơi gọi chỉ gắn hộp thoại khi mở (kèm `key` theo người
 * dùng), nên mỗi lần mở là form mới với dữ liệu của đúng người đó. `onSubmit` ghi vào kho; kho từ chối (email trùng, quản trị viên
 * cuối…) thì câu lỗi hiện ngay trong hộp thoại và dữ liệu đang nhập giữ nguyên. `roleBlock`: vai trò chỉ xem, kèm lý do.
 *
 * `scope` là phạm vi của người quản trị đang mở form (FE-0-08): `platform` (quản trị hệ thống) chỉ mời ba vai trò nền tảng và không có ô
 * kho — tài khoản nền tảng không thuộc kho hay công ty nào (FE-0-03); `company` (quản trị công ty) chỉ mời năm vai trò công ty, kho /
 * chi nhánh bắt buộc, và kho gán công ty của người quản trị cho tài khoản mới. Form không mời thứ kho sẽ từ chối.
 */
export function UserFormDialog({
  scope,
  user,
  companies = [],
  roleBlock = null,
  onClose,
  onSubmit,
}: {
  scope: UserScope
  user?: User
  companies?: CompanyOption[]
  roleBlock?: AccountBlock | null
  onClose: () => void
  onSubmit: (values: UserFormValues) => Promise<void>
}) {
  const t = useT()
  const isEdit = Boolean(user)
  const [serverError, setServerError] = useState<unknown>(null)

  const platform = scope === 'platform'
  const schema = useMemo(() => userFormSchema(scope), [scope])

  const form = useForm<UserFormInput, unknown, UserFormValues>({
    resolver: zodResolver(schema),
    defaultValues: user ? toFormValues(user) : emptyValues(scope),
  })

  const errors = form.formState.errors
  const role = useWatch({ control: form.control, name: 'role' })
  const allowedRoles: Role[] = platform
    ? [
      'systemAdmin',
      'systemManager',
      'systemSupporter',
      'companyAdmin',
    ]
    : [
      'companyManager',
      'dispatcher',
      'warehouse',
      'driver',
    ]

  const roleOptions = allowedRoles.map((value) => ({
    value,
    label: t(`roles.${value}`),
  }))
  async function handleValid(values: UserFormValues) {
    setServerError(null)
    try {
      await onSubmit(values)
    } catch (error) {
      setServerError(error)
    }
  }

  const companyOptions = companies.map((company) => ({
    value: company.id,
    label: company.name,
  }))

  const needsCompany =
    platform && role === 'companyAdmin'

  return (
    <Dialog open onOpenChange={(open) => (open || form.formState.isSubmitting ? undefined : onClose())}>
      <DialogContent className="w-140">
        <form noValidate onSubmit={form.handleSubmit(handleValid)}>
          <div className="flex flex-col gap-5 px-6 pt-6">
            <div className="flex flex-col gap-1">
              <DialogTitle className="text-h2 font-semibold">
                {isEdit ? t('admin.users.form.editTitle') : t('admin.users.form.createTitle')}
              </DialogTitle>
              <DialogDescription className="text-body text-text-2">
                {t(`admin.users.form.${isEdit ? 'editDescription' : 'createDescription'}${platform ? 'Platform' : ''}`)}
              </DialogDescription>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input label={t('admin.users.form.fullName')} placeholder={t('admin.users.form.fullNamePlaceholder')} error={translateUserFormError(t, errors.fullName?.message)} {...form.register('fullName')} />
              <Input label={t('admin.users.form.phone')} placeholder="0901 234 567" className="font-mono" error={translateUserFormError(t, errors.phone?.message)} {...form.register('phone')} />
              <Input label={t('admin.users.form.email')} type="email" placeholder={t('admin.users.form.emailPlaceholder')} error={translateUserFormError(t, errors.email?.message)} {...form.register('email')} />
              {platform ? null : (
                <Input
                  label={t('admin.users.form.depot')}
                  placeholder={t('admin.users.form.depotPlaceholder')}
                  error={translateUserFormError(t, errors.depot?.message)}
                  {...form.register('depot')}
                />
              )}
              {roleBlock ? (
                <div className="flex flex-col gap-1.5">
                  <span className="text-body font-medium text-text">{t('admin.users.form.role')}</span>
                  <span className="flex h-10 items-center rounded-md border border-border bg-surface px-3 text-body text-text-2">
                    {t(`roles.${role}`)}
                  </span>
                  <span className="text-caption text-text-3">{t(`admin.users.blocked.${roleBlock}`)}</span>
                </div>
              ) : (
                <SelectField
                  control={form.control}
                  name="role"
                  label={t('admin.users.form.role')}
                  options={roleOptions}
                  hint={t('admin.users.form.device', { device: t(`admin.users.devices.${role}`) })}
                />
              )}
              {needsCompany ? (
                <div className="col-span-2">
                  <SelectField
                    control={form.control}
                    name="companyId"
                    label={t('admin.users.form.company')}
                    options={companyOptions}
                  />
                </div>
              ) : null}
            </div>

            {serverError ? (
              <p role="alert" className="rounded-md border border-badge-danger-border bg-badge-danger-bg px-3 py-2 text-body text-badge-danger-fg">
                {dataErrorMessage(serverError, t)}
              </p>
            ) : null}
          </div>

          <DialogFooter className="justify-end px-6">
            <DialogClose asChild>
              {/* Đang lưu thì không huỷ được: thao tác không dừng giữa chừng, huỷ chỉ làm người dùng tưởng chưa lưu */}
              <Button type="button" variant="secondary" disabled={form.formState.isSubmitting}>{t('admin.users.form.cancel')}</Button>
            </DialogClose>
            <Button type="submit" variant="primary" loading={form.formState.isSubmitting}>
              {isEdit ? t('admin.users.form.save') : t('admin.users.form.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
