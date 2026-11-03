import { apiFetch, apiFetchBlob } from '@/lib/api-client'

type ApiResponse<T> = {
  success: boolean
  message?: string
  data: T
}

// Một lỗi trên dòng Excel do BE trả về.
export type ImportRowErrorApi = {
  rowIndex: number
  field: string
  errorCode: string
  detail: string | null
  message: string
}

// Một cảnh báo trên dòng Excel do BE trả về.
export type ImportRowWarningApi = {
  rowIndex: number
  field: string
  errorCode: string
  detail: string | null
  message: string
}

// Dòng Excel hợp lệ được BE đọc và kiểm tra.
export type PackageImportRowApi = {
  rowIndex: number
  packageCode: string
  packageName?: string | null
  lengthCm: number
  widthCm: number
  heightCm: number
  weightKg: number
  quantity?: number
  handlingClass: string
  destination: string
}

// POST /api/packages/import/preview
export type ImportPreviewResultApi = {
  totalRows: number
  validCount: number
  errors: ImportRowErrorApi[]
  warnings: ImportRowWarningApi[]
  validRows: PackageImportRowApi[]
}

// POST /api/packages/import/confirm
export type ImportConfirmResultApi = {
  totalImported: number
  packageIds: number[]
  orderId: number | null
}

function createImportFormData(file: File): FormData {
  const formData = new FormData()
  formData.append('file', file)
  return formData
}

function createConfirmImportFormData(
  file: File,
  deliveryRequirementId: string,
): FormData {
  const id = Number(deliveryRequirementId)

  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error('Invalid delivery requirement ID')
  }

  const formData = createImportFormData(file)

  formData.append('deliveryRequirementId', String(id))

  return formData
}

/**
 * Xem trước, kiểm tra file XLSX.
 * Không ghi dữ liệu vào PostgreSQL.
 */
export async function previewCargoPackageImport(
  file: File,
): Promise<ImportPreviewResultApi> {
  const response = await apiFetch<ApiResponse<ImportPreviewResultApi>>(
    '/api/packages/import/preview',
    {
      method: 'POST',
      body: createImportFormData(file),
    },
  )

  return response.data
}

/**
 * Xác nhận nhập các kiện vật lý từ Excel vào PostgreSQL.
 *
 * Backend nhận:
 * - file: MultipartFile
 * - deliveryRequirementId: Long
 *
 * Backend tự tạo kiện, QR và liên kết với DeliveryRequirement.
 */
export async function confirmCargoPackageImport(
  file: File,
  deliveryRequirementId: string,
): Promise<ImportConfirmResultApi> {
  const response = await apiFetch<ApiResponse<ImportConfirmResultApi>>(
    '/api/packages/import/confirm',
    {
      method: 'POST',
      body: createConfirmImportFormData(
        file,
        deliveryRequirementId,
      ),
    },
  )

  return response.data
}

/**
 * Tải mẫu Excel XLSX chung từ BE.
 */
export function downloadCargoPackageImportTemplate(): Promise<Blob> {
  return apiFetchBlob('/api/packages/import/template')
}
