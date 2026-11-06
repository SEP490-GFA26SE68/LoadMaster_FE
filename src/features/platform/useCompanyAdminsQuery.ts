import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listCompanyAdmins, updateCompanyAdmin, updateCompanyAdminStatus, type CompanyAdminStatus, type CompanyAdminUser } from './company-admins-api'

/**
 * Tab "Quản trị công ty" của màn Công ty khi nối backend. Khoá dưới `['companies']` để mọi lần ghi của màn Công ty (tạo công ty kèm quản
 * trị đầu tiên) làm mới cả tab; sửa ở đây làm mới `['companies']` và `['users']`. `staleTime: 0` — tài khoản đổi ở màn Người dùng.
 */
const KEY = ['companies', 'admins'] as const

export function useCompanyAdminsQuery() {
  return useQuery({ queryKey: KEY, queryFn: listCompanyAdmins, staleTime: 0 })
}

export type CompanyAdminChange = {
  readonly admin: CompanyAdminUser
  readonly fullName: string
  readonly phoneNumber: string
  readonly status: CompanyAdminStatus
}

/** Ghi phần đã đổi: thông tin (PUT) rồi trạng thái (PATCH). */
export function useSaveCompanyAdminMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ admin, fullName, phoneNumber, status }: CompanyAdminChange) => {
      if (fullName !== admin.fullName || phoneNumber !== (admin.phoneNumber ?? '')) {
        await updateCompanyAdmin(admin, { fullName, phoneNumber: phoneNumber === '' ? undefined : phoneNumber })
      }
      if (status !== admin.status) await updateCompanyAdminStatus(admin.id, status)
    },
    onSuccess: () => Promise.all([client.invalidateQueries({ queryKey: ['companies'] }), client.invalidateQueries({ queryKey: ['users'] })]),
  })
}
