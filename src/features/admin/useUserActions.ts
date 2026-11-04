import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/features/auth/AuthProvider'
import { dataErrorMessage, useT } from '@/lib/i18n'
import type { TemporaryPassword } from '@/lib/mock-db'
import type { User } from '@/types/user'
import { isSameAccount } from './account-guards'
import type { UserFormValues } from './user-form.schema'
import type { UserAction } from './UserRowMenu'
import {
  useCreateUserMutation,
  useDeleteUserMutation,
  useResetPasswordMutation,
  useSetUserStatusMutation,
  useUpdateUserMutation,
} from './useUsersQuery'

/** Hộp thoại đang mở của màn Người dùng — trạng thái giao diện, không phải dữ liệu nghiệp vụ (dữ liệu nằm ở kho qua Query). */
export type UserDialog =
  | { readonly kind: 'create' }
  | { readonly kind: 'edit'; readonly user: User }
  | { readonly kind: 'reset'; readonly user: User }
  | { readonly kind: 'delete'; readonly user: User }
  | { readonly kind: 'password'; readonly result: TemporaryPassword; readonly reason: 'created' | 'reset' }

/**
 * Thao tác trên tài khoản (LM-092): ghi qua mutation của kho, toast chỉ báo việc đã xảy ra, lỗi kho hiện bằng `dataErrorMessage`.
 * Tạo và đặt lại mật khẩu mở hộp thoại mật khẩu tạm (hiện một lần). Sửa chính mình thì đọc lại người dùng của phiên để nav rail đổi tên.
 * Hộp thoại không đóng được khi thao tác đang chạy (`pending`); khi xong, sửa/xoá chỉ đóng đúng hộp thoại đã gửi thao tác đó, không đóng
 * nhầm hộp thoại khác đã mở sau.
 */
export function useUserActions() {
  const t = useT()
  const { user: currentUser, refreshUser } = useAuth()
  const [dialog, setDialog] = useState<UserDialog | null>(null)
  const createUser = useCreateUserMutation()
  const updateUser = useUpdateUserMutation()
  const setStatus = useSetUserStatusMutation()
  const deleteUser = useDeleteUserMutation()
  const resetPassword = useResetPasswordMutation()
  const { mutate: mutateStatus } = setStatus

  const handleAction = useCallback((action: UserAction, user: User) => {
    if (action === 'edit' || action === 'delete') setDialog({ kind: action, user })
    else if (action === 'resetPassword') setDialog({ kind: 'reset', user })
    else {
      const status = user.status === 'active' ? 'suspended' : 'active'
      mutateStatus({ id: user.id, status }, {
        onSuccess: () => toast.success(t(status === 'suspended' ? 'admin.users.locked' : 'admin.users.unlocked', { name: user.fullName })),
        onError: (error) => toast.error(dataErrorMessage(error, t)),
      })
    }
  }, [mutateStatus, t])

  return {
    dialog,
    close: () => setDialog(null),
    openCreate: () => setDialog({ kind: 'create' }),
    handleAction,
    async submitCreate(values: UserFormValues) {
      const result = await createUser.mutateAsync(values)
      setDialog({ kind: 'password', result, reason: 'created' })
    },
    async submitEdit(user: User, values: UserFormValues) {
      await updateUser.mutateAsync({ id: user.id, changes: values, current: user })
      if (currentUser !== null && isSameAccount(user, currentUser)) refreshUser()
      toast.success(t('admin.users.updated', { name: values.fullName }))
      setDialog((current) => (current?.kind === 'edit' && current.user.id === user.id ? null : current))
    },
    resetPending: resetPassword.isPending,
    confirmReset(user: User) {
      resetPassword.mutate(user.id, {
        onSuccess: (result) => setDialog({ kind: 'password', result, reason: 'reset' }),
        onError: (error) => {
          toast.error(dataErrorMessage(error, t))
          setDialog((current) => (current?.kind === 'reset' && current.user.id === user.id ? null : current))
        },
      })
    },
    deletePending: deleteUser.isPending,
    confirmDelete(user: User) {
      deleteUser.mutate(user.id, {
        onSuccess: () => toast.success(t('admin.users.deleted', { name: user.fullName })),
        onError: (error) => toast.error(dataErrorMessage(error, t)),
        onSettled: () => setDialog((current) => (current?.kind === 'delete' && current.user.id === user.id ? null : current)),
      })
    },
  }
}
