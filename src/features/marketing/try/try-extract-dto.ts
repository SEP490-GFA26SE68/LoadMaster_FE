/**
 * Hợp đồng của `POST /api/assistant/public/try-extract` (trang công khai, không token). Chỉ `try-extract-api.ts` import file này; kiểu của
 * app nằm ở `try-extract-values.ts`.
 */

/** `text` tối đa 1.000 ký tự; `guestKey` là mã khách của phiên trình duyệt (cùng mã với khung chat của trợ lý). */
export type TryExtractRequestDto = {
  readonly text: string
  readonly locale: 'vi' | 'en'
  readonly guestKey: string
}

export type TryExtractTruckDto = {
  readonly lengthCm?: number | null
  readonly widthCm?: number | null
  readonly heightCm?: number | null
  readonly payloadKg?: number | null
}

export type TryExtractCartonDto = {
  readonly lengthCm?: number | null
  readonly widthCm?: number | null
  readonly heightCm?: number | null
  readonly weightKg?: number | null
  readonly quantity?: number | null
  readonly stop?: number | null
}

export type TryExtractResponseDto = {
  readonly truck?: TryExtractTruckDto | null
  readonly cartons?: readonly TryExtractCartonDto[] | null
  readonly assumptions?: readonly string[] | null
  readonly missing?: readonly string[] | null
}
