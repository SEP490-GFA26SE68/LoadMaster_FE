import { useFormat, useT } from '@/lib/i18n'
import type { AssistantEntry } from './assistant-session'
import { AnswerLinks } from './AssistantAiAnswer'

type BriefingEntry = Extract<AssistantEntry, { kind: 'briefing' }>

/**
 * Bản tin "Tóm tắt hôm nay" trong bong bóng của Lumo: các gạch đầu dòng của máy chủ (một câu — ngày không có việc — thì là một đoạn), giờ
 * máy chủ đếm số (bản tin có thể là bản đệm tới 2 giờ trước), rồi liên kết người xem mở được. Chữ vẽ bằng phần tử thường, không HTML.
 */
export function BriefingAnswer({ entry, onNavigate }: { entry: BriefingEntry; onNavigate?: () => void }) {
  const t = useT()
  const format = useFormat()
  const [only] = entry.bullets
  return (
    <div className="flex flex-col gap-2">
      {entry.bullets.length === 1 && only !== undefined ? (
        <p className="m-0">{only}</p>
      ) : (
        <ul className="m-0 flex list-disc flex-col gap-1 pl-5">
          {entry.bullets.map((bullet, index) => <li key={index}>{bullet}</li>)}
        </ul>
      )}
      <p className="m-0 text-small text-ink-3 in-[.assistant-touch]:text-body-lg">{t('assistant.briefing.generatedAt', { time: format.time(entry.generatedAt) })}</p>
      <AnswerLinks links={entry.links} onNavigate={onNavigate} />
    </div>
  )
}
