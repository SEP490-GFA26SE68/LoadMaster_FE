import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Company, NewUser, UserChanges } from '@/lib/mock-db'
import type { User, UserStatus } from '@/types/user'
import {
  USER_ACTIVITY_AVAILABLE,
  USER_DEPOT_AVAILABLE,
  createUser,
  deleteUser,
  fetchCompanies,
  fetchUserCompanies,
  fetchUsers,
  resetPassword,
  setUserStatus,
  updateUser,
} from './users-api'

/** Màn có cột, ô kho / chi nhánh và lần hoạt động gần nhất không — backend chưa có hai trường đó (`users-api.ts`). */
export const userDepotAvailable = USER_DEPOT_AVAILABLE
export const userActivityAvailable = USER_ACTIVITY_AVAILABLE

/**
 * Người dùng qua TanStack Query (mục 9, LM-092) — thay `useState` + `users.mock.ts` cũ. Mọi ghi làm mới danh sách người dùng và
 * nhật ký (mỗi thao tác thêm một sự kiện). Danh sách theo phạm vi của người đăng nhập; `AuthProvider` xoá cache khi đổi người.
 */
export function useUsersQuery() {
  return useQuery({ queryKey: ['users'], queryFn: fetchUsers, staleTime: 0 })
}

/**
 * Tên công ty theo mã, cho cột và bộ lọc công ty (FE-0-08). Chỉ đọc kho khi `enabled` — quản trị công ty không có cột hay bộ lọc đó.
 * Tên công ty ít đổi nên không tự làm mới; màn Công ty (FE-8-06) vô hiệu khoá này sau mỗi lần tạo hoặc sửa.
 */
export function useCompanyNamesQuery(enabled: boolean) {
  return useQuery({ queryKey: ['companies'], queryFn: enabled ? fetchCompanies : skipToken, select: companyNames, staleTime: Infinity })
}

/**
 * Tên công ty cho cột và bộ lọc công ty của màn Người dùng: cùng nguồn với mã công ty của danh sách người dùng (backend khi nối, kho mẫu
 * khi không). Nằm dưới khoá `['users']` vì mã công ty đi theo danh sách đó; Nhật ký, Hỗ trợ vẫn đọc `useCompanyNamesQuery` của kho mẫu.
 */
export function useUserCompanyNamesQuery(enabled: boolean) {
  return useQuery({ queryKey: ['users', 'companies'], queryFn: enabled ? fetchUserCompanies : skipToken, staleTime: Infinity })
}

export type CompanyName = { readonly id: string; readonly name: string }

function companyNames(companies: readonly Company[]): CompanyName[] {
  return companies.map(({ id, name }) => ({ id, name }))
}

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
    mutationFn: ({ id, changes, current }: { id: string; changes: UserChanges; current: User }) => updateUser(id, changes, current),
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
