import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import type { Permission } from '@/features/auth/permissions'
import { downloadBlob } from '@/features/trips/download-file'
import type { PackageFlag, PackageInput, PackageTypeInput } from '@/lib/mock-db'
import {
  clearPackageFlag,
  confirmPackageImport,
  createPackage,
  deletePackageType,
  deletePoolPackage,
  downloadPackageImportTemplate,
  exportPackageLabelsPdf,
  fetchPackageDetail,
  fetchPackageLabels,
  fetchPackages,
  fetchPackageTypes,
  lookupPackages,
  PACKAGE_POOL_SUPPORT,
  previewPackageImport,
  reportPackageFound,
  savePackageType,
  scanPackage,
  type LabelSelection,
} from './package-pool-api'
import type { PackageImportPreview } from './package-pool-import'

export { isUnknownPackage, MAX_PDF_LABELS, PACKAGE_POOL_SUPPORT } from './package-pool-api'

/**
 * Người xem đọc được kho kiện từ nguồn đang dùng: backend chỉ cho điều phối viên (`PACKAGE_POOL_SUPPORT.dispatcherOnly`), nên nút tra cứu
 * và liên kết in lại nhãn của màn kho không hiện với nhân viên kho khi kho kiện nối backend.
 */
export function packagePoolReachable(can: (permission: Permission) => boolean): boolean {
  return !PACKAGE_POOL_SUPPORT.dispatcherOnly || can('packages.manage')
}

/**
 * Hook Query của kho kiện (FE-3b-03) — component không gọi `package-pool-api.ts` trực tiếp (mục 9). Khoá `['package-pool', …]` không
 * mang người dùng: `AuthProvider` xoá cache lúc đổi người (FE-0-02). Trạng thái kiện đổi theo đơn và chuyến ở màn khác nên đọc lại mỗi
 * lần mở màn (`staleTime: 0`). `PACKAGE_POOL_SUPPORT` nói màn nào có nguồn dữ liệu khi nối backend.
 */

export const PACKAGE_TYPES_KEY = ['package-types'] as const
export const PACKAGE_POOL_KEY = ['package-pool'] as const

export function usePackageTypesQuery() {
  return useQuery({ queryKey: PACKAGE_TYPES_KEY, queryFn: fetchPackageTypes })
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

/** `enabled: false` khi người xem không đọc được kho kiện ở nguồn đang dùng (backend chỉ mở cho điều phối viên). */
export function usePackagesQuery({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({ queryKey: [...PACKAGE_POOL_KEY, 'list'], queryFn: fetchPackages, staleTime: 0, enabled })
}

/** Chi tiết một kiện kèm lịch sử (`/kien-hang`, panel chi tiết); `id` `null` thì không gọi kho. */
export function usePackageDetailQuery(id: string | null) {
  return useQuery({ queryKey: [...PACKAGE_POOL_KEY, 'detail', id], queryFn: () => fetchPackageDetail(id ?? ''), enabled: id !== null, staleTime: 0 })
}

/** Nhãn để in (`/kien-hang/nhan`): các kiện đã chọn, hoặc mọi kiện của một chuyến. `enabled: false` khi nguồn đang dùng không có nhãn đó. */
export function usePackageLabelsQuery(selection: LabelSelection, { enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: [...PACKAGE_POOL_KEY, 'labels', selection.tripId ?? null, selection.ids ?? null],
    queryFn: () => fetchPackageLabels(selection),
    staleTime: 0,
    enabled,
  })
}

/**
 * Tra cứu theo mã đang gõ trên URL (`/tra-cuu-kien?ma=`); `code` rỗng thì không gọi kho (màn truyền rỗng cả khi người xem không tra
 * được ở nguồn đang dùng). Không khớp: lỗi `QR_UNKNOWN`, không thử lại.
 */
export function usePackageLookupQuery(code: string) {
  return useQuery({ queryKey: [...PACKAGE_POOL_KEY, 'lookup', code], queryFn: () => lookupPackages(code), enabled: code !== '', staleTime: 0, retry: false })
}

/** Tạo kiện đổi kho kiện, loại kiện (đếm kiện đang dùng) và yêu cầu giao (kiện để chọn). */
function refreshPool(client: QueryClient) {
  return Promise.all([PACKAGE_POOL_KEY, PACKAGE_TYPES_KEY, ['requirements']].map((queryKey) => client.invalidateQueries({ queryKey })))
}

/** Thêm một kiện; trả kiện vừa tạo (đã có mã QR) để màn mở chi tiết. */
export function useCreatePackageMutation() {
  const client = useQueryClient()
  return useMutation({ mutationFn: (input: PackageInput) => createPackage(input), onSuccess: () => refreshPool(client) })
}

/**
 * Xoá một kiện (chỉ khi nối backend): kho kiện và kiện để chọn vào yêu cầu giao đều đổi. Chi tiết của chính kiện vừa xoá không đọc lại
 * (backend trả 404) — panel đóng khi danh sách mới về.
 */
export function useDeletePackageMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deletePoolPackage(id),
    onSuccess: (_data, id) => Promise.all([
      client.invalidateQueries({ queryKey: PACKAGE_POOL_KEY, predicate: (query) => !(query.queryKey[1] === 'detail' && query.queryKey[2] === id) }),
      client.invalidateQueries({ queryKey: PACKAGE_TYPES_KEY }),
      client.invalidateQueries({ queryKey: ['requirements'] }),
    ]),
  })
}

/** Tải PDF nhãn backend dựng cho các kiện `ids` về máy dưới tên `fileName`. */
export function useExportLabelsPdfMutation() {
  return useMutation({
    mutationFn: async ({ ids, fileName }: { ids: readonly string[]; fileName: string }) => {
      downloadBlob(await exportPackageLabelsPdf(ids), fileName)
    },
  })
}

/** Gỡ cờ: kiện lại chọn được vào yêu cầu giao, nên làm mới cả yêu cầu giao. */
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
export function useScanPackageMutation() {
  return useMutation({ mutationFn: (token: string) => scanPackage(token) })
}

/** Kho quét thấy lại kiện mang cờ "Không tìm thấy": cờ được gỡ nên kho kiện và kiện để chọn vào yêu cầu giao đều đổi. */
export function useReportPackageFoundMutation() {
  const client = useQueryClient()
  return useMutation({ mutationFn: (token: string) => reportPackageFound(token), onSuccess: () => refreshPool(client) })
}
