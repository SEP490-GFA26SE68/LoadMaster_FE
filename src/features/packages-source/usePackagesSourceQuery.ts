import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/AuthProvider'
import type { PackageTypeInput } from '@/lib/mock-db'
import {
  deletePackageType,
  fetchPackageLabels,
  fetchPackageType,
  fetchPackageTypes,
  fetchRegisteredPackage,
  fetchRegisteredPackages,
  findPackageByQr,
  registerPackages,
  savePackageType,
  type RegisterInput,
} from './packages-source-api'

/**
 * Hook Query của nguồn hàng (LM-104) — component không gọi `packages-source-api.ts` trực tiếp (mục 9). Mã người dùng nằm trong khoá
 * của kiện đăng ký: đổi người đăng nhập thì đọc lại (kiện thuộc công ty của người đăng ký; kho lọc theo công ty ở FE-0-02). Trạng thái
 * kiện đổi theo đơn và chuyến ở màn khác nên đọc lại mỗi lần mở màn.
 */

export const PACKAGE_TYPES_KEY = ['package-types'] as const
export const REGISTERED_PACKAGES_KEY = ['registered-packages'] as const

export function usePackageTypesQuery() {
  return useQuery({ queryKey: PACKAGE_TYPES_KEY, queryFn: fetchPackageTypes })
}

/** `id` rỗng (form thêm mới) thì không gọi kho. */
export function usePackageTypeQuery(id: string) {
  return useQuery({ queryKey: [...PACKAGE_TYPES_KEY, id], queryFn: () => fetchPackageType(id), enabled: id !== '' })
}

export function useSavePackageTypeMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ input, id }: { input: PackageTypeInput; id?: string }) => savePackageType(input, id),
    onSuccess: () => client.invalidateQueries({ queryKey: PACKAGE_TYPES_KEY }),
  })
}

export function useDeletePackageTypeMutation() {
  const client = useQueryClient()
  return useMutation({ mutationFn: (id: string) => deletePackageType(id), onSuccess: () => client.invalidateQueries({ queryKey: PACKAGE_TYPES_KEY }) })
}

export function useRegisteredPackagesQuery() {
  const { user } = useAuth()
  return useQuery({ queryKey: [...REGISTERED_PACKAGES_KEY, 'list', user?.id ?? null], queryFn: fetchRegisteredPackages, staleTime: 0 })
}

export function useRegisteredPackageQuery(id: string) {
  const { user } = useAuth()
  return useQuery({ queryKey: [...REGISTERED_PACKAGES_KEY, 'one', id, user?.id ?? null], queryFn: () => fetchRegisteredPackage(id), enabled: id !== '', staleTime: 0 })
}

/** Nhãn để in (`/kien-hang/nhan`): `ids` vắng là mọi kiện người đăng nhập thấy. */
export function usePackageLabelsQuery(ids?: readonly string[]) {
  const { user } = useAuth()
  return useQuery({ queryKey: [...REGISTERED_PACKAGES_KEY, 'labels', ids ?? 'all', user?.id ?? null], queryFn: () => fetchPackageLabels(ids), staleTime: 0 })
}

/** Ghi kiện đăng ký đổi danh sách kiện, loại kiện (đếm kiện đang dùng) và đơn hàng (kiện để chọn). */
function refreshSourcing(client: QueryClient) {
  return Promise.all([REGISTERED_PACKAGES_KEY, PACKAGE_TYPES_KEY, ['orders']].map((queryKey) => client.invalidateQueries({ queryKey })))
}

/** Đăng ký một / theo số lượng / nhiều dòng (`RegisterInput`); trả kiện vừa tạo để màn in nhãn ngay. */
export function useRegisterPackagesMutation() {
  const client = useQueryClient()
  return useMutation({ mutationFn: (input: RegisterInput) => registerPackages(input), onSuccess: () => refreshSourcing(client) })
}

/** Tra kiện theo mã QR — dạng mutation vì chạy theo cú quét, không phải dữ liệu nền của màn. */
export function useFindPackageByQrMutation() {
  return useMutation({ mutationFn: (token: string) => findPackageByQr(token) })
}
