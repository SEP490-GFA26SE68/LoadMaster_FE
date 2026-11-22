/**
 * Hàm → endpoint backend (FE-0-09). Trang công khai, không cần đăng nhập.
 *   extractTry → POST /api/assistant/public/try-extract
 *
 * Chỉ khi nhóm `assistant` nối máy chủ; kho mẫu không có ô mô tả, hàm từ chối `NOT_SUPPORTED` mà không gọi mạng.
 */

import { api, ApiError } from '@/lib/api-client'
import { usesBackend } from '@/lib/backend-config'
import type { Locale } from '@/lib/i18n'
import type { TryExtractCartonDto, TryExtractRequestDto, TryExtractResponseDto, TryExtractTruckDto } from './try-extract-dto'
import type { ExtractCarton, ExtractTruck, TryExtract } from './try-extract-values'

const ON_BACKEND = usesBackend('assistant')

/** Ô "Mô tả hàng bằng lời" có không: chỉ khi trợ lý AI chạy trên máy chủ. */
export const TRY_EXTRACT_AVAILABLE = ON_BACKEND

/** Một lượt gọi mô hình: chờ lâu hơn giới hạn mặc định của client, như khung chat của trợ lý. */
export const TRY_EXTRACT_TIMEOUT_MS = 45_000

export type TryExtractRequest = { readonly text: string; readonly locale: Locale; readonly guestKey: string }

/** Số máy chủ trả; thứ khác số hữu hạn (thiếu, chữ, NaN) là `null` — ô đó để trống. */
const numberOf = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null)
const textsOf = (values: readonly unknown[] | null | undefined): string[] =>
  (values ?? []).filter((value): value is string => typeof value === 'string' && value.trim() !== '')

function truckOf(dto: TryExtractTruckDto): ExtractTruck {
  return { lengthCm: numberOf(dto.lengthCm), widthCm: numberOf(dto.widthCm), heightCm: numberOf(dto.heightCm), payloadKg: numberOf(dto.payloadKg) }
}

function cartonOf(dto: TryExtractCartonDto): ExtractCarton {
  return {
    lengthCm: numberOf(dto.lengthCm),
    widthCm: numberOf(dto.widthCm),
    heightCm: numberOf(dto.heightCm),
    weightKg: numberOf(dto.weightKg),
    quantity: numberOf(dto.quantity),
    stop: numberOf(dto.stop),
  }
}

// POST /api/assistant/public/try-extract
export async function extractTry({ text, locale, guestKey }: TryExtractRequest): Promise<TryExtract> {
  if (!ON_BACKEND) throw new ApiError('NOT_SUPPORTED')
  const body: TryExtractRequestDto = { text, locale, guestKey }
  const dto = await api().post<TryExtractResponseDto | null>('/api/assistant/public/try-extract', { body, timeoutMs: TRY_EXTRACT_TIMEOUT_MS })
  return {
    truck: dto?.truck ? truckOf(dto.truck) : null,
    cartons: (dto?.cartons ?? []).filter((carton) => typeof carton === 'object' && carton !== null).map(cartonOf),
    assumptions: textsOf(dto?.assumptions),
    missing: textsOf(dto?.missing),
  }
}
