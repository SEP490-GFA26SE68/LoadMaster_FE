import { useQuery } from '@tanstack/react-query'
import { useLocale } from '@/lib/i18n'
import { assistantSession } from './assistant-session'
import { fetchBriefing } from './briefing-api'

/**
 * Bản tin "Tóm tắt hôm nay". Mở khung chat không gọi gì (`enabled: false`): chỉ `request` — khi người dùng bấm nút — mới đọc máy chủ.
 * Lượt bấm vào cuộc trò chuyện như một câu hỏi, bản tin (hay câu lỗi) như câu trả lời của Lumo. Hàm đọc không nhận `signal` nên đóng khung
 * chat giữa lúc chờ không huỷ lượt gọi: bản tin vẫn vào cuộc trò chuyện; người dùng đã "Bắt đầu lại" thì bản tin về muộn bị bỏ.
 */
export function useBriefingQuery() {
  const { locale } = useLocale()
  const { refetch } = useQuery({
    queryKey: ['assistant', 'briefing', locale],
    queryFn: () => fetchBriefing(locale),
    enabled: false,
    retry: false,
  })

  async function request(label: string) {
    if (assistantSession.get().pending) return
    const generation = assistantSession.generation()
    assistantSession.append({ kind: 'user', text: label })
    assistantSession.setPending(true)
    const result = await refetch()
    if (generation !== assistantSession.generation()) return
    if (result.isSuccess) assistantSession.append({ kind: 'briefing', ...result.data })
    else assistantSession.append({ kind: 'error', cause: result.error })
    assistantSession.setPending(false)
  }

  return { request }
}
