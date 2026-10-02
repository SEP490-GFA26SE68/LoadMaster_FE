import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { downloadBlob } from '@/features/trips/download-file'
import type { PackageFlag, PackageInput, PackageTypeInput } from '@/lib/mock-db'
import {
  clearPackageFlag,
  confirmPackageImport,
  createPackage,
  deletePackageType,
  downloadPackageImportTemplate,
  fetchPackageDetail,
  fetchPackageLabels,
  fetchPackages,
  fetchPackageType,
  fetchPackageTypes,
  findPackageByQr,
  previewPackageImport,
  savePackageType,
} from './package-pool-api'
import type { PackageImportPreview } from './package-pool-import'

/**
 * Hook Query của kho kiện (FE-3b-03) — component không gọi `package-pool-api.ts` trực tiếp (mục 9). Khoá `['package-pool', …]` không
 * mang người dùng: `AuthProvider` xoá cache lúc đổi người (FE-0-02). Trạng thái kiện đổi theo đơn và chuyến ở màn khác nên đọc lại mỗi
 * lần mở màn (`staleTime: 0`).
 */

export const PACKAGE_TYPES_KEY = ['package-types'] as const
export const PACKAGE_POOL_KEY = ['package-pool'] as const

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

export function usePackagesQuery() {
  return useQuery({ queryKey: [...PACKAGE_POOL_KEY, 'list'], queryFn: fetchPackages, staleTime: 0 })
}

/** Chi tiết một kiện kèm lịch sử (`/kien-hang`, panel chi tiết); `id` `null` thì không gọi kho. */
export function usePackageDetailQuery(id: string | null) {
  return useQuery({ queryKey: [...PACKAGE_POOL_KEY, 'detail', id], queryFn: () => fetchPackageDetail(id ?? ''), enabled: id !== null, staleTime: 0 })
}

/** Nhãn để in (`/kien-hang/nhan`): `ids` vắng là mọi kiện người đăng nhập thấy. */
export function usePackageLabelsQuery(ids?: readonly string[]) {
  return useQuery({ queryKey: [...PACKAGE_POOL_KEY, 'labels', ids ?? 'all'], queryFn: () => fetchPackageLabels(ids), staleTime: 0 })
}

/** Tạo kiện đổi kho kiện, loại kiện (đếm kiện đang dùng) và đơn hàng (kiện để chọn). */
function refreshPool(client: QueryClient) {
  return Promise.all([PACKAGE_POOL_KEY, PACKAGE_TYPES_KEY, ['orders']].map((queryKey) => client.invalidateQueries({ queryKey })))
}

/** Thêm một kiện; trả kiện vừa tạo (đã có mã QR) để màn mở chi tiết. */
export function useCreatePackageMutation() {
  const client = useQueryClient()
  return useMutation({ mutationFn: (input: PackageInput) => createPackage(input), onSuccess: () => refreshPool(client) })
}

/** Gỡ cờ: kiện lại chọn được vào đơn, nên làm mới cả đơn hàng. */
export function useClearPackageFlagMutation() {
  const client = useQueryClient()
  return useMutation({ mutationFn: ({ id, flag }: { id: string; flag: PackageFlag }) => clearPackageFlag(id, flag), onSuccess: () => refreshPool(client) })
}

/** Đọc và kiểm file — dạng mutation vì chạy theo lần chọn file, không phải dữ liệu nền của màn. */
export function usePreviewPackageImportMutation() {
  return useMutation({ mutationFn: (file: File) => previewPackageImport(file) })
}

export function useConfirmPackageImportMutation() {
  const client = useQueryClient()
  return useMutation({ mutationFn: (preview: PackageImportPreview) => confirmPackageImport(preview), onSuccess: () => refreshPool(client) })
}

/** Tải file mẫu nhập kho kiện về máy dưới tên `fileName`. */
export function useDownloadImportTemplateMutation() {
  return useMutation({
    mutationFn: async ({ format, rows, sheet, fileName }: { format: 'xlsx' | 'csv'; rows: readonly (readonly (string | number)[])[]; sheet: string; fileName: string }) => {
      downloadBlob(await downloadPackageImportTemplate(format, rows, sheet), fileName)
    },
  })
}

/** Tra kiện theo mã QR — dạng mutation vì chạy theo cú quét, không phải dữ liệu nền của màn. */
export function useFindPackageByQrMutation() {
  return useMutation({ mutationFn: (token: string) => findPackageByQr(token) })
}
