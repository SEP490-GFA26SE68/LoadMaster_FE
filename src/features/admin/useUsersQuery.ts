import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { NewUser, UserChanges } from '@/lib/mock-db'
import type { UserStatus } from '@/types/user'
import { createUser, deleteUser, fetchCompanies, fetchUsers, resetPassword, setUserStatus, updateUser } from './users-api'

/**
 * Người dùng qua TanStack Query (mục 9, LM-092) — thay `useState` + `users.mock.ts` cũ. Mọi ghi làm mới danh sách người dùng và
 * nhật ký (mỗi thao tác thêm một sự kiện). Danh sách theo phạm vi của người đăng nhập; `AuthProvider` xoá cache khi đổi người.
 */
export function useUsersQuery() {
  return useQuery({ queryKey: ['users'], queryFn: fetchUsers, staleTime: 0 })
}

/**
 * Tên công ty theo mã, cho cột và bộ lọc công ty (FE-0-08). Chỉ đọc kho khi `enabled` — quản trị công ty không có cột hay bộ lọc đó.
 * Chưa có màn nào sửa công ty nên không cần làm mới.
 */
export function useCompanyNamesQuery(enabled: boolean) {
  return useQuery({
    queryKey: ['companies'],
    queryFn: enabled ? fetchCompanies : skipToken,
    staleTime: Infinity,
  })
}

export type CompanyName = { readonly id: string; readonly name: string }



function useInvalidateUsers() {
  const client = useQueryClient()
  return () => Promise.all([
    client.invalidateQueries({ queryKey: ['users'] }),
    client.invalidateQueries({ queryKey: ['audit'] }),
  ])
}

export function useCreateUserMutation() {
  const invalidate = useInvalidateUsers()
  return useMutation({ mutationFn: (input: NewUser) => createUser(input), onSuccess: invalidate })
}

export function useUpdateUserMutation() {
  const invalidate = useInvalidateUsers()
  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: UserChanges }) => updateUser(id, changes),
    onSuccess: invalidate,
  })
}

export function useSetUserStatusMutation() {
  const invalidate = useInvalidateUsers()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: UserStatus }) => setUserStatus(id, status),
    onSuccess: invalidate,
  })
}

export function useDeleteUserMutation() {
  const invalidate = useInvalidateUsers()
  return useMutation({ mutationFn: (id: string) => deleteUser(id), onSuccess: invalidate })
}

export function useResetPasswordMutation() {
  const invalidate = useInvalidateUsers()
  return useMutation({ mutationFn: (id: string) => resetPassword(id), onSuccess: invalidate })
}
