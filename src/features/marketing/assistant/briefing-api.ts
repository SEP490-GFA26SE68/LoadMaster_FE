import { api } from '@/lib/api-client'
import { isoFromBackend } from '@/lib/backend-time'
import { usesBackend } from '@/lib/backend-config'
import type { Locale } from '@/lib/i18n'
import type { Role } from '@/types/user'
import { ASSISTANT_TIMEOUT_MS, type AssistantLink } from './assistant-api'

/**
 * Bản tin "Tóm tắt hôm nay" của trợ lý (điều phối viên, quản lý công ty).
 *
 * | Hàm             | Endpoint                         |
 * |-----------------|----------------------------------|
 * | `fetchBriefing` | `GET /api/assistant/briefing`    |
 *
 * Chỉ có khi nhóm `assistant` nối máy chủ: kho mẫu không có bản tin, nút không hiện. Máy chủ đếm số và đệm bản tin 2 giờ theo người dùng;
 * lỗi (`ASSISTANT_*`, hết gói, mất mạng) ném ra như mọi lượt gọi để màn nói đúng lý do — không có câu soạn sẵn thay thế.
 */
const ON_BACKEND = usesBackend('assistant')

const BRIEFING_ROLES: readonly Role[] = ['dispatcher', 'companyManager']

type BriefingDto = {
  readonly generatedAt: string
  readonly bullets?: readonly string[] | null
  readonly links?: readonly { readonly label: string; readonly to: string }[] | null
}

export type Briefing = {
  /** ISO 8601: lúc máy chủ đếm số (bản tin có thể là bản đệm tới 2 giờ trước). */
  readonly generatedAt: string
  readonly bullets: readonly string[]
  readonly links: readonly AssistantLink[]
}

/** Vai trò này có nút "Tóm tắt hôm nay" không. */
export function briefingAvailable(role: Role | undefined): boolean {
  return ON_BACKEND && role !== undefined && BRIEFING_ROLES.includes(role)
}

// GET /api/assistant/briefing
export async function fetchBriefing(locale: Locale): Promise<Briefing> {
  const dto = await api().get<BriefingDto>('/api/assistant/briefing', { query: { locale }, timeoutMs: ASSISTANT_TIMEOUT_MS })
  return {
    generatedAt: isoFromBackend(dto.generatedAt),
    bullets: dto.bullets ?? [],
    links: (dto.links ?? []).map(({ label, to }) => ({ label, to })),
  }
}
