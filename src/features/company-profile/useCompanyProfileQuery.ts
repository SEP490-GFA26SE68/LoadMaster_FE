import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchCompanyProfile, saveCompanyProfile, type CompanyProfileSave } from './company-profile-api'

const PROFILE_KEY = ['company-profile'] as const

/**
 * Hook Query của Thông tin công ty `/cong-ty`. Khoá `['company-profile']`, `staleTime: 0` — quản trị hệ thống sửa được cùng công ty ở màn
 * Công ty. Lưu xong, bản nơi lưu trả về thay luôn dữ liệu của màn (không đọc lại), rồi làm mới tên công ty của màn Người dùng, Nhật ký
 * (`['companies']`) và nhật ký (`company.updated`).
 */
export function useCompanyProfileQuery() {
  return useQuery({ queryKey: PROFILE_KEY, queryFn: fetchCompanyProfile, staleTime: 0 })
}

export function useSaveCompanyProfileMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (changes: CompanyProfileSave) => saveCompanyProfile(changes),
    onSuccess: (saved) => {
      client.setQueryData(PROFILE_KEY, saved)
      return Promise.all(['companies', 'audit'].map((key) => client.invalidateQueries({ queryKey: [key] })))
    },
  })
}
