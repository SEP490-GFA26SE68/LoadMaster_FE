
import { apiFetch } from '@/lib/api-client'

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
      geometry: {
        location: {
          lat: number
          lng: number
        }
      }
    } | null
  }
}

export async function searchAddress(
  query: string,
): Promise<AddressSuggestion[]> {
  const wanted = query.trim()

  if (wanted.length < 2) return []

  const response = await apiFetch<AutocompleteResponse>(
    `/api/places/autocomplete?input=${encodeURIComponent(wanted)}`,
  )

  if (response.data.status === 'ZERO_RESULTS') return []

  if (response.data.status !== 'OK') {
    throw new Error('Goong autocomplete failed')
  }

  return (response.data.predictions ?? [])
    .filter((item) => Boolean(item.place_id))
    .map((item) => ({
      placeId: item.place_id,
      name:
        item.structured_formatting?.main_text ||
        item.description,
      address: item.description,
      region:
        item.structured_formatting?.secondary_text || '',
    }))
}

export async function resolveAddress(
  suggestion: AddressSuggestion,
): Promise<ResolvedAddress> {
  const response = await apiFetch<PlaceDetailResponse>(
    `/api/places/detail?placeId=${encodeURIComponent(
      suggestion.placeId,
    )}`,
  )

  const result = response.data.result
  const location = result?.geometry?.location

  if (
    response.data.status !== 'OK' ||
    !location ||
    !Number.isFinite(location.lat) ||
    !Number.isFinite(location.lng)
  ) {
    throw new Error('Goong place detail has no valid coordinates')
  }

  return {
    placeId: suggestion.placeId,
    name: suggestion.name,
    address:
      result?.formatted_address || suggestion.address,
    lat: location.lat,
    lng: location.lng,
  }
}
