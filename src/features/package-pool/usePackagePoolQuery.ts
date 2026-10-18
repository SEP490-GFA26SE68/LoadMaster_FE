import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { downloadBlob } from '@/features/trips/download-file'
import type {
  PackageFlag,
  PackageInput,
} from '@/lib/mock-db'
import {
  fetchPackages as fetchCargoPackages,
  fetchPackage as fetchCargoPackage,
  createPackage as createCargoPackage,
  createPackages as createCargoPackages,
  updatePackage as updateCargoPackage,
  deletePackage as deleteCargoPackage,
  type CargoPackageInput,
} from './packages-api'
import {
  fetchPackageTypes,
  savePackageType,
  deletePackageType,
  type PackageTypeInput,
} from './package-types-api'
import { getMockDb } from '@/lib/mock-db'
import {
  clearPackageFlag,
  createPackage,
  fetchPackageDetail,
  fetchPackageLabels,
  fetchPackages,
  lookupPackages,
  reportPackageFound,
  scanPackage,
  type LabelSelection,
} from './package-pool-api'

import {
  previewCargoPackageImport,
  confirmCargoPackageImport,
  downloadCargoPackageImportTemplate,
} from './package-import-api'

/**
 * Hook Query của kho kiện (FE-3b-03) — component không gọi `package-pool-api.ts` trực tiếp (mục 9). Khoá `['package-pool', …]` không
 * mang người dùng: `AuthProvider` xoá cache lúc đổi người (FE-0-02). Trạng thái kiện đổi theo đơn và chuyến ở màn khác nên đọc lại mỗi
 * lần mở màn (`staleTime: 0`).
 */


export const PACKAGE_TYPES_KEY = ['package-types'] as const
export const PACKAGE_POOL_KEY = ['package-pool'] as const
export const CARGO_PACKAGES_KEY = ['cargo-packages'] as const


/**
 * Lấy danh sách loại kiện từ BE.
 * page bắt đầu từ 0.
 */
export function usePackageTypesQuery(
  page = 0,
  size = 25,
) {
  return useQuery({
    queryKey: [
      ...PACKAGE_TYPES_KEY,
      'list',
      page,
      size,
    ],
    queryFn: () => fetchPackageTypes(page, size),
  })
}

export function useMockPackageTypesQuery() {
  return useQuery({
    queryKey: [
      ...PACKAGE_POOL_KEY,
      'mock-package-types',
    ],
    queryFn: () =>
      getMockDb().listPackageTypes(),
  })
}

/**
 * Tạo mới hoặc cập nhật loại kiện.
 */
export function useSavePackageTypeMutation() {
  const client = useQueryClient()

  return useMutation({
    mutationFn: ({
      input,
      id,
    }: {
      input: PackageTypeInput
      id?: string
    }) => savePackageType(input, id),

    onSuccess: async () => {
      await client.invalidateQueries({
        queryKey: PACKAGE_TYPES_KEY,
      })
    },
  })
}

/**
 * Xóa loại kiện.
 */
export function useDeletePackageTypeMutation() {
  const client = useQueryClient()

  return useMutation({
    mutationFn: (id: string) =>
      deletePackageType(id),

    onSuccess: async () => {
      await client.invalidateQueries({
        queryKey: PACKAGE_TYPES_KEY,
      })
    },
  })
}


export function usePackagesQuery() {
  return useQuery({ queryKey: [...PACKAGE_POOL_KEY, 'list'], queryFn: fetchPackages, staleTime: 0 })
}

/** Chi tiết một kiện kèm lịch sử (`/kien-hang`, panel chi tiết); `id` `null` thì không gọi kho. */
export function usePackageDetailQuery(id: string | null) {
  return useQuery({ queryKey: [...PACKAGE_POOL_KEY, 'detail', id], queryFn: () => fetchPackageDetail(id ?? ''), enabled: id !== null, staleTime: 0 })
}

/** Nhãn để in (`/kien-hang/nhan`): các kiện đã chọn, hoặc mọi kiện của một chuyến. */
export function usePackageLabelsQuery(selection: LabelSelection) {
  return useQuery({
    queryKey: [...PACKAGE_POOL_KEY, 'labels', selection.tripId ?? null, selection.ids ?? null],
    queryFn: () => fetchPackageLabels(selection),
    staleTime: 0,
  })
}

/** Tra cứu theo mã đang gõ trên URL (`/tra-cuu-kien?ma=`); `code` rỗng thì không gọi kho. Không khớp: lỗi `QR_UNKNOWN`, không thử lại. */
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

/** Gỡ cờ: kiện lại chọn được vào yêu cầu giao, nên làm mới cả yêu cầu giao. */
export function useClearPackageFlagMutation() {
  const client = useQueryClient()
  return useMutation({ mutationFn: ({ id, flag }: { id: string; flag: PackageFlag }) => clearPackageFlag(id, flag), onSuccess: () => refreshPool(client) })
}

/** Đọc và kiểm file — dạng mutation vì chạy theo lần chọn file, không phải dữ liệu nền của màn. */

/**
 * Gửi XLSX đến BE để xem trước.
 * API: POST /api/packages/import/preview
 */
export function usePreviewPackageImportMutation() {
  return useMutation({
    mutationFn: (file: File) =>
      previewCargoPackageImport(file),
  })
}

/**
 * Gửi lại XLSX gốc để BE lưu các kiện vào PostgreSQL.
 * API: POST /api/packages/import/confirm
 */
export type ConfirmPackageImportInput = {
  file: File
  deliveryRequirementId: string
}

export function useConfirmPackageImportMutation() {
  const client = useQueryClient()

  return useMutation({
    mutationFn: ({
      file,
      deliveryRequirementId,
    }: ConfirmPackageImportInput) =>
      confirmCargoPackageImport(
        file,
        deliveryRequirementId,
      ),

    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({
          queryKey: CARGO_PACKAGES_KEY,
        }),
        refreshPool(client),
      ])
    },
  })
}


/**
 * Tải mẫu XLSX chung từ BE.
 * API: GET /api/packages/import/template
 */
export function useDownloadImportTemplateMutation() {
  return useMutation({
    mutationFn: async () => {
      const blob =
        await downloadCargoPackageImportTemplate()

      downloadBlob(
        blob,
        'mau-nhap-kien-chung.xlsx',
      )
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

/**
 * Danh sách CargoPackage từ BE.
 * page bắt đầu từ 0.
 */
export function useCargoPackagesQuery(
  page = 0,
  size = 25,
) {
  return useQuery({
    queryKey: [
      ...CARGO_PACKAGES_KEY,
      'list',
      page,
      size,
    ],
    queryFn: () => fetchCargoPackages(page, size),
    staleTime: 0,
  })
}

/**
 * Chi tiết một kiện từ BE.
 */
export function useCargoPackageQuery(id: string | null) {
  return useQuery({
    queryKey: [
      ...CARGO_PACKAGES_KEY,
      'detail',
      id,
    ],
    queryFn: () => fetchCargoPackage(id!),
    enabled: id !== null,
    staleTime: 0,
  })
}

/**
 * Tạo kiện mới trong PostgreSQL.
 */
export function useCreateCargoPackageMutation() {
  const client = useQueryClient()

  return useMutation({
    mutationFn: (input: CargoPackageInput) =>
      createCargoPackage(input),

    onSuccess: async () => {
      await client.invalidateQueries({
        queryKey: CARGO_PACKAGES_KEY,
      })
    },
  })
}


/**
 * Tạo một hoặc nhiều kiện thủ công trong PostgreSQL.
 * API: POST /api/packages/batch
 *
 * Trả về danh sách kiện vật lý đã tạo,
 * mỗi kiện có ID và QR token riêng.
 */
export function useCreateCargoPackagesMutation() {
  const client = useQueryClient()

  return useMutation({
    mutationFn: (input: CargoPackageInput) =>
      createCargoPackages(input),

    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({
          queryKey: CARGO_PACKAGES_KEY,
        }),
        refreshPool(client),
      ])
    },
  })
}


/**
 * Cập nhật kiện.
 */
export function useUpdateCargoPackageMutation() {
  const client = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string
      input: CargoPackageInput
    }) => updateCargoPackage(id, input),

    onSuccess: async () => {
      await client.invalidateQueries({
        queryKey: CARGO_PACKAGES_KEY,
      })
    },
  })
}

/**
 * Xóa kiện.
 */
export function useDeleteCargoPackageMutation() {
  const client = useQueryClient()

  return useMutation({
    mutationFn: (id: string) =>
      deleteCargoPackage(id),

    onSuccess: async () => {
      await client.invalidateQueries({
        queryKey: CARGO_PACKAGES_KEY,
      })
    },
  })
}