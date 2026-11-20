/**
 * DTO của `POST /api/assistant/requirement-draft` (`RequirementDraftResponse` của máy chủ). Chỉ `requirement-draft-api.ts` import file
 * này. Trường văn bản không nêu là `null`; `deadline` là giờ Việt Nam không múi giờ (`yyyy-MM-ddTHH:mm:ss`).
 */
export type RequirementDraftRequestDto = { readonly text: string }

export type RequirementDraftPackageDto = {
  readonly description: string
  readonly quantity: number | null
  readonly lengthCm: number | null
  readonly widthCm: number | null
  readonly heightCm: number | null
  readonly weightKg: number | null
}

export type RequirementDraftDto = {
  readonly destinationText: string | null
  readonly deadline: string | null
  readonly priority: string | null
  readonly expectedPackageCount: number | null
  readonly note: string | null
  readonly customerNameGuess: string | null
  readonly packages: readonly RequirementDraftPackageDto[] | null
  readonly missing: readonly string[] | null
}
