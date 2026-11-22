import { api, ApiError } from '@/lib/api-client'
import { usesBackend } from '@/lib/backend-config'
import { isoFromBackend } from '@/lib/backend-time'
import { REQUIREMENT_PRIORITIES, type RequirementPriority } from '@/lib/mock-db'
import type { RequirementDraftDto, RequirementDraftRequestDto } from './requirement-draft-dto'

/**
 * Bản nháp yêu cầu giao từ nội dung khách gửi (kỹ năng E của trợ lý Lumo) — nơi duy nhất biết về mạng của việc này.
 *
 * | Hàm                | Endpoint                                  |
 * |--------------------|-------------------------------------------|
 * | `draftRequirement` | `POST /api/assistant/requirement-draft`   |
 *
 * Máy chủ chỉ trả bản nháp, không tạo gì. Chỉ có khi nhóm `assistant` nối máy chủ; kho mẫu không có (D-20: không nút giả).
 */
const ON_BACKEND = usesBackend('assistant')

/** Màn có ô dán nội dung của khách không. */
export const REQUIREMENT_DRAFT_AVAILABLE = ON_BACKEND
/** Giới hạn của máy chủ (`assistant.max-draft-chars`), tính theo ký tự. */
export const REQUIREMENT_DRAFT_MAX_CHARS = 4000
/** Một lượt đọc của mô hình lâu hơn giới hạn mặc định của client. */
const DRAFT_TIMEOUT_MS = 45_000

/** Bốn ô của form máy chủ báo còn thiếu, theo thứ tự trên form. */
export const DRAFT_FIELDS = ['destinationText', 'deadline', 'priority', 'expectedPackageCount'] as const
export type DraftField = (typeof DRAFT_FIELDS)[number]

export type RequirementDraftPackage = {
  readonly description: string
  readonly quantity: number | null
  readonly lengthCm: number | null
  readonly widthCm: number | null
  readonly heightCm: number | null
  readonly weightKg: number | null
}

export type RequirementDraft = {
  readonly destinationText: string | null
  /** Thời điểm ISO; `null` khi văn bản không nêu đủ ngày và giờ, hoặc hạn đã qua. */
  readonly deadline: string | null
  readonly priority: RequirementPriority | null
  readonly expectedPackageCount: number | null
  readonly note: string | null
  /** Tên bên gửi văn bản nêu — chỉ để người dùng tự chọn khách, không điền vào ô nào. */
  readonly customerNameGuess: string | null
  /** Hàng văn bản liệt kê — chỉ để đối chiếu, không điền vào ô nào. */
  readonly packages: readonly RequirementDraftPackage[]
  readonly missing: readonly DraftField[]
}

const isPriority = (value: string | null): value is RequirementPriority =>
  value !== null && (REQUIREMENT_PRIORITIES as readonly string[]).includes(value)

const isDraftField = (value: string): value is DraftField => (DRAFT_FIELDS as readonly string[]).includes(value)

function draftFromDto(dto: RequirementDraftDto): RequirementDraft {
  return {
    destinationText: dto.destinationText,
    deadline: dto.deadline === null ? null : isoFromBackend(dto.deadline),
    priority: isPriority(dto.priority) ? dto.priority : null,
    expectedPackageCount: dto.expectedPackageCount,
    note: dto.note,
    customerNameGuess: dto.customerNameGuess,
    packages: (dto.packages ?? []).map((item) => ({
      description: item.description,
      quantity: item.quantity,
      lengthCm: item.lengthCm,
      widthCm: item.widthCm,
      heightCm: item.heightCm,
      weightKg: item.weightKg,
    })),
    missing: (dto.missing ?? []).filter(isDraftField),
  }
}

// POST /api/assistant/requirement-draft
export async function draftRequirement(text: string): Promise<RequirementDraft> {
  if (!ON_BACKEND) throw new ApiError('NOT_SUPPORTED')
  const body: RequirementDraftRequestDto = { text }
  const dto = await api().post<RequirementDraftDto>('/api/assistant/requirement-draft', { body, timeoutMs: DRAFT_TIMEOUT_MS })
  return draftFromDto(dto)
}
