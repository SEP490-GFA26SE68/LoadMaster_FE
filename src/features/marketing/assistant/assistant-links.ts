import type { AssistantLink } from './assistant-api'

/**
 * Liên kết máy chủ gắn dưới câu trả lời của mô hình (thuần). Máy chủ đã dựng đường dẫn theo vai trò, màn vẫn kiểm lại: chỉ giữ đường dẫn
 * trong app (một `/` đầu, không khoảng trắng, không `\`), có nhãn, người xem mở được (`canOpen` — bảng route thật và quyền,
 * `app/route-access.ts`), không trùng đích, tối đa ba.
 */
export const MAX_ASSISTANT_LINKS = 3

const IN_APP_PATH = /^\/(?!\/)[^\s\\]*$/

export function openableLinks(links: readonly AssistantLink[], canOpen: (to: string) => boolean): AssistantLink[] {
  const seen = new Set<string>()
  const kept: AssistantLink[] = []
  for (const link of links) {
    if (kept.length === MAX_ASSISTANT_LINKS) break
    if (link.label.trim() === '' || !IN_APP_PATH.test(link.to) || seen.has(link.to) || !canOpen(link.to)) continue
    seen.add(link.to)
    kept.push(link)
  }
  return kept
}
