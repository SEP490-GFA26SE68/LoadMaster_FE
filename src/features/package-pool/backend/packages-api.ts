import { auditEntryOf, type AuditLogDto, type ServerAuditEntry } from '@/features/admin/audit-dto'
import { apiFetch, apiFetchBlob } from '@/lib/api-client'

export type PackageStatus =
  | 'PENDING'
  | 'PLANNED'
  | 'LOADED'
  | 'DELIVERED'
  | 'CANCELLED'

/** Cờ kho đặt khi bỏ kiện khỏi chuyến: thiếu lúc soạn, hỏng lúc xếp. */
export type PackageFlag = 'NOT_FOUND' | 'DAMAGED'

export type HandlingClass =
  | 'STANDARD'
  | 'FRAGILE'
  | 'REFRIGERATED'
  | 'HAZARDOUS'
  | 'HIGH_VALUE'

// Dữ liệu thực tế BE trả về
export type CargoPackageApi = {
  id: number
  orderId: number | null
  packageTypeId: number | null
  deliveryRequirementId: number | null
  customerName: string | null
  receivedPackageCount: number | null
  expectedPackageCount: number | null
  packageCode: string | null
  trackingBarcode: string | null
  qrToken: string
  actualLength: number
  actualWidth: number
  actualHeight: number
  actualWeightKg: number
  handlingClass: HandlingClass
  destination: string
  status: PackageStatus
  /** Máy chủ cũ không trả trường này. */
  flag?: PackageFlag | null
  isPinned: boolean
  packageName: string | null
  note: string | null

  orientation: string | null
  uprightOnly: boolean | null
  fragilityLevel: number | null
  stackable: boolean | null
  maxTopLoadKg: number | null
  maxLayers: number | null
  minSupportRatio: number | null
  priority: number | null
  mustLoad: boolean | null
  packingGroup: string | null
}

// Model sử dụng cho FE
export type CargoPackage = {
  id: string
  orderId: string | undefined
  packageTypeId: string | undefined
  deliveryRequirementId: string | undefined
  customerName: string | null
  receivedPackageCount: number | null
  expectedPackageCount: number | null
  packageCode: string
  trackingBarcode: string | null
  qrToken: string
  lengthCm: number
  widthCm: number
  heightCm: number
  weightKg: number
  handlingClass: HandlingClass
  destination: string
  status: PackageStatus
  /** Cờ thiếu / hỏng; `null` là không cờ. */
  flag: PackageFlag | null
  isPinned: boolean
  packageName: string | null
  note: string | null

  orientation: string | null
  uprightOnly: boolean | null
  fragilityLevel: number | null
  stackable: boolean | null
  maxTopLoadKg: number | null
  maxLayers: number | null
  minSupportRatio: number | null
  priority: number | null
  mustLoad: boolean | null
  packingGroup: string | null
}


export type CargoPackageInput = {
  deliveryRequirementId?: string
  orderId?: string
  packageTypeId?: string
  packageCode?: string
  packageName?: string
  quantity?: number

  // Tất cả kích thước đều sử dụng cm.
  lengthCm?: number
  widthCm?: number
  heightCm?: number
  weightKg: number

  handlingClass: HandlingClass
  destination: string
  note?: string

  orientation?: string
  uprightOnly?: boolean | null
  fragilityLevel?: number | null
  stackable?: boolean | null
  maxTopLoadKg?: number | null
  maxLayers?: number | null
  minSupportRatio?: number | null
  priority?: number | null
  mustLoad?: boolean | null
  packingGroup?: string
}


type ApiResponse<T> = {
  success: boolean
  message?: string
  data: T
}

export type PageResponse<T> = {
  success: boolean
  message?: string
  data: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  last: boolean
}

function mapPackage(item: CargoPackageApi): CargoPackage {
  return {
    id: String(item.id),
    orderId:
      item.orderId == null
        ? undefined
        : String(item.orderId),
    packageTypeId:
      item.packageTypeId == null
        ? undefined
        : String(item.packageTypeId),
    deliveryRequirementId:
      item.deliveryRequirementId == null
        ? undefined
        : String(item.deliveryRequirementId),

    customerName: item.customerName ?? null,

    receivedPackageCount: item.receivedPackageCount ?? null,

    expectedPackageCount: item.expectedPackageCount ?? null,
    packageCode: item.packageCode ?? '',
    trackingBarcode: item.trackingBarcode,
    qrToken: item.qrToken,
    lengthCm: item.actualLength,
    widthCm: item.actualWidth,
    heightCm: item.actualHeight,
    weightKg: item.actualWeightKg,
    handlingClass: item.handlingClass,
    destination: item.destination,
    status: item.status,
    flag: item.flag ?? null,
    isPinned: item.isPinned,
    packageName: item.packageName ?? null,
    note: item.note ?? null,

    orientation: item.orientation ?? null,
    uprightOnly: item.uprightOnly ?? null,
    fragilityLevel: item.fragilityLevel ?? null,
    stackable: item.stackable ?? null,
    maxTopLoadKg: item.maxTopLoadKg ?? null,
    maxLayers: item.maxLayers ?? null,
    minSupportRatio: item.minSupportRatio ?? null,
    priority: item.priority ?? null,
    mustLoad: item.mustLoad ?? null,
    packingGroup: item.packingGroup ?? null,
  }
}


function toRequest(
  input: CargoPackageInput,
  includeRequirement = false,
) {
  return {
    ...(includeRequirement
      ? {
        deliveryRequirementId: input.deliveryRequirementId
          ? Number(input.deliveryRequirementId)
          : null,
      }
      : {}),
    orderId: input.orderId ? Number(input.orderId) : null,
    packageTypeId: input.packageTypeId
      ? Number(input.packageTypeId)
      : null,

    packageCode: input.packageCode?.trim() || null,
    packageName: input.packageName?.trim() || null,
    quantity: input.quantity ?? 1,

    actualLength: input.lengthCm ?? null,
    actualWidth: input.widthCm ?? null,
    actualHeight: input.heightCm ?? null,
    actualWeightKg: input.weightKg,

    handlingClass: input.handlingClass,
    destination: input.destination.trim(),
    note: input.note ?? null,

    orientation: input.orientation?.trim() || null,
    uprightOnly: input.uprightOnly ?? null,
    fragilityLevel: input.fragilityLevel ?? null,
    stackable: input.stackable ?? null,
    maxTopLoadKg: input.maxTopLoadKg ?? null,
    maxLayers: input.maxLayers ?? null,
    minSupportRatio: input.minSupportRatio ?? null,
    priority: input.priority ?? null,
    mustLoad: input.mustLoad ?? null,
    packingGroup: input.packingGroup?.trim() || null,
  }
}



// POST /api/packages/batch
export async function createPackages(
  input: CargoPackageInput,
): Promise<CargoPackage[]> {
  const response = await apiFetch<ApiResponse<CargoPackageApi[]>>(
    '/api/packages/batch',
    {
      method: 'POST',
      body: JSON.stringify(toRequest(input, true)),
    },
  )

  return response.data.map(mapPackage)
}


// GET /api/packages?page=0&size=25
export async function fetchPackages(
  page = 0,
  size = 25,
): Promise<PageResponse<CargoPackage>> {
  const params = new URLSearchParams({
    page: String(page),
    size: String(size),
  })

  const response = await apiFetch<PageResponse<CargoPackageApi>>(
    `/api/packages?${params.toString()}`,
  )

  return {
    ...response,
    data: response.data.map(mapPackage),
  }
}

// GET /api/packages/{id}
export async function fetchPackage(
  id: string,
): Promise<CargoPackage> {
  const response = await apiFetch<ApiResponse<CargoPackageApi>>(
    `/api/packages/${encodeURIComponent(id)}`,
  )

  return mapPackage(response.data)
}

// POST /api/packages
export async function createPackage(
  input: CargoPackageInput,
): Promise<CargoPackage> {
  const response = await apiFetch<ApiResponse<CargoPackageApi>>(
    '/api/packages',
    {
      method: 'POST',
      body: JSON.stringify(toRequest(input)),
    },
  )

  return mapPackage(response.data)
}

// PUT /api/packages/{id}
export async function updatePackage(
  id: string,
  input: CargoPackageInput,
): Promise<CargoPackage> {
  const response = await apiFetch<ApiResponse<CargoPackageApi>>(
    `/api/packages/${encodeURIComponent(id)}`,
    {
      method: 'PUT',
      body: JSON.stringify(toRequest(input)),
    },
  )

  return mapPackage(response.data)
}

// DELETE /api/packages/{id}/flag — điều phối viên gỡ cờ thiếu / hỏng; kiện không mang cờ: 409 `PACKAGE_NOT_FLAGGED`
export async function clearPackageFlag(
  id: string,
): Promise<CargoPackage> {
  const response = await apiFetch<ApiResponse<CargoPackageApi>>(
    `/api/packages/${encodeURIComponent(id)}/flag`,
    {
      method: 'DELETE',
    },
  )

  return mapPackage(response.data)
}

// DELETE /api/packages/{id}
export async function deletePackage(
  id: string,
): Promise<void> {
  await apiFetch(
    `/api/packages/${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
    },
  )
}

/**
 * Lịch sử của một kiện: nhật ký của công ty về kiện (đối tượng là kiện, hoặc sự kiện mang mã kiện — báo thiếu, kiện hỏng, tìm thấy lại…),
 * mới nhất trước, tối đa 100 dòng. Máy chủ không ghi lúc tạo kiện nên kiện mới có thể chưa có dòng nào.
 */
// GET /api/packages/{id}/history
export async function fetchPackageHistory(id: string): Promise<ServerAuditEntry[]> {
  const response = await apiFetch<ApiResponse<AuditLogDto[]>>(`/api/packages/${encodeURIComponent(id)}/history`)
  return response.data.map(auditEntryOf)
}

/** Kiện cần nhãn: đúng các kiện `packageIds` (mã số của máy chủ), hoặc mọi kiện chuyến `tripId` (mã chuyến hay mã số) đang giữ. */
export type LabelsPdfSource = { readonly packageIds: readonly number[] } | { readonly tripId: string }

/**
 * File PDF nhãn máy chủ dựng, 1–200 kiện (quá số: `EXPORT_TOO_MANY_PACKAGES`). Theo chuyến: chuyến không có hay của công ty khác
 * `TRIP_NOT_FOUND`, chưa có kiện `TRIP_HAS_NO_PACKAGES`.
 */
// POST /api/packages/export/labels · GET /api/packages/export/labels/trip/{tripId}
export function fetchLabelsPdf(source: LabelsPdfSource): Promise<Blob> {
  if ('tripId' in source) return apiFetchBlob(`/api/packages/export/labels/trip/${encodeURIComponent(source.tripId)}`)
  return apiFetchBlob('/api/packages/export/labels', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ packageIds: source.packageIds }),
  })
}
