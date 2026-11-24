import { MessageSquareText } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { TopicId } from './assistant-kb'

/** Cỡ chữ của khung chat trên máy cảm ứng và trong bản cảm ứng của màn kho, tài xế (`.assistant-touch`): 16 px. Nút cao 48 px trên máy cảm ứng, 56 px ở bản cảm ứng. */
export const CHAT_TOUCH = 'pointer-coarse:text-body-lg in-[.assistant-touch]:text-body-lg'

/** Một nút gợi ý: câu hỏi ngắn hay mức chọn nhanh. Bo 10 px như nút (không dạng viên thuốc), chữ xuống dòng được. */
export function Chip({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex min-h-9 items-center rounded-md border border-cyan-200 bg-bg px-3 py-1.5 text-left text-small font-medium text-primary',
        'transition-colors duration-(--dur-fast) hover:bg-primary-bg disabled:cursor-not-allowed disabled:border-border disabled:text-text-disabled',
        'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        'pointer-coarse:min-h-12 in-[.assistant-touch]:min-h-14',
        CHAT_TOUCH,
      )}
    >
      {children}
    </button>
  )
}

/** Hàng câu hỏi gợi ý: bấm là hỏi đúng chủ đề đó. */
export function TopicChips({ label, topics, onAsk, disabled }: {
  label: string
  topics: readonly TopicId[]
  onAsk: (question: string, topicId: TopicId) => void
  disabled?: boolean
}) {
  const t = useT()
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {topics.map((id) => {
        const question = t(`assistant.topics.${id}.chip`)
        return (
          <Chip key={id} disabled={disabled} onClick={() => onAsk(question, id)}>
            {question}
          </Chip>
        )
      })}
    </div>
  )
}

/** "Chưa đúng ý? Hỏi đội LoadMaster" (sau câu trả lời) hay "Gửi câu hỏi cho đội LoadMaster" (khi không có câu trả lời). */
export function HandoffButton({ onHandoff, strong = false }: { onHandoff: () => void; strong?: boolean }) {
  const t = useT()
  return (
    <Button
      type="button"
      variant={strong ? 'secondary' : 'ghost'}
      size="sm"
      onClick={onHandoff}
      className={cn('self-start', !strong && 'px-2 text-primary hover:text-primary-hover', 'pointer-coarse:h-12 in-[.assistant-touch]:h-14', CHAT_TOUCH)}
    >
      <MessageSquareText aria-hidden />
      {t(strong ? 'assistant.handoff.ask' : 'assistant.handoff.notRight')}
    </Button>
  )
}
