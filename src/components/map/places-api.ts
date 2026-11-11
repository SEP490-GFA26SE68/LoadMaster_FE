/**
 * Hàm → endpoint backend (FE-0-09):
 *   addressSearchAvailable → (không gọi mạng)
 *   searchAddress          → GET /api/places/autocomplete?input=
 *   resolveAddress         → GET /api/places/detail?placeId=
 * Không đăng nhập bằng backend (kho mẫu, test, CI): tìm trong danh sách địa danh mẫu của seed (`SEED_PLACES`), toạ độ gần đúng ở mức
 * khu vực. Trình duyệt không bao giờ gọi Goong trực tiếp: khoá REST của Goong chỉ nằm ở server.
 */

import { getCachedCurrentUser, isAuthenticated } from '@/features/auth/auth-api'
import { apiFetch } from '@/lib/api-client'
import { SEED_PLACES } from '@/lib/mock-db'
import type { Role } from '@/types/user'
import { placeAddress, searchPlaces } from './place-search'

/** Vai trò máy chủ cho tìm địa chỉ (`DISPATCHER`, `MANAGER`, `DRIVER`, `ADMIN`, `SYSTEM_ADMIN`). */
const SERVER_SEARCH_ROLES: ReadonlySet<Role> = new Set<Role>(['dispatcher', 'companyManager', 'driver', 'companyAdmin', 'systemAdmin'])

/** Có ô tìm địa chỉ không: kho mẫu luôn có (địa danh mẫu); đăng nhập bằng máy chủ thì chỉ vai trò máy chủ cho tìm — vai trò khác gõ toạ độ. */
export function addressSearchAvailable(): boolean {
  if (!isAuthenticated()) return true
  const user = getCachedCurrentUser()
  return user !== null && SERVER_SEARCH_ROLES.has(user.role)
}

export type AddressSuggestion = {
  placeId: string
  name: string
  address: string
  region: string
}

export type ResolvedAddress = {
  placeId: string
  name: string
  address: string
  lat: number
  lng: number
}

type AutocompleteResponse = {
  success: boolean
  data: {
    status: string
    predictions: {
      place_id: string
      description: string
      structured_formatting?: {
        main_text?: string
        secondary_text?: string
      }
    }[]
  }
}

type PlaceDetailResponse = {
  success: boolean
  data: {
    status: string
    result: {
      place_id: string
      formatted_address: string
      geometry: { location: { lat: number; lng: number } }
    } | null
  }
}

// GET /api/places/autocomplete?input=
export async function searchAddress(query: string): Promise<AddressSuggestion[]> {
  const wanted = query.trim()
  if (!isAuthenticated()) {
    return searchPlaces(SEED_PLACES, wanted).map((place) => ({
      placeId: place.id,
      name: place.name,
      address: placeAddress(place),
      region: place.region,
    }))
  }
  if (wanted.length < 2) return []

  const response = await apiFetch<AutocompleteResponse>(`/api/places/autocomplete?input=${encodeURIComponent(wanted)}`)
  if (response.data.status === 'ZERO_RESULTS') return []
  if (response.data.status !== 'OK') throw new Error('Goong autocomplete failed')

  return (response.data.predictions ?? [])
    .filter((item) => Boolean(item.place_id))
    .map((item) => ({
      placeId: item.place_id,
      name: item.structured_formatting?.main_text || item.description,
      address: item.description,
      region: item.structured_formatting?.secondary_text || '',
    }))
}

// GET /api/places/detail?placeId=
export async function resolveAddress(suggestion: AddressSuggestion): Promise<ResolvedAddress> {
  if (!isAuthenticated()) {
    const place = SEED_PLACES.find((item) => item.id === suggestion.placeId)
    if (!place) throw new Error('Địa danh mẫu không có trong danh sách')
    return { placeId: place.id, name: place.name, address: suggestion.address, lat: place.lat, lng: place.lng }
  }

  const response = await apiFetch<PlaceDetailResponse>(`/api/places/detail?placeId=${encodeURIComponent(suggestion.placeId)}`)
  const result = response.data.result
  const location = result?.geometry?.location
  if (response.data.status !== 'OK' || !location || !Number.isFinite(location.lat) || !Number.isFinite(location.lng)) {
    throw new Error('Goong place detail has no valid coordinates')
  }
  return {
    placeId: suggestion.placeId,
    name: suggestion.name,
    address: result?.formatted_address || suggestion.address,
    lat: location.lat,
    lng: location.lng,
  }
}
