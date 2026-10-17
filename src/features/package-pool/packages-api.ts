import { apiFetch } from '@/lib/api-client'

export type PackageStatus =
  | 'PENDING'
  | 'PLANNED'
  | 'LOADED'
  | 'DELIVERED'
  | 'CANCELLED'

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


function toRequest(input: CargoPackageInput) {
  return {
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
      body: JSON.stringify(toRequest(input)),
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