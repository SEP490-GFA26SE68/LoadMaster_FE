import { ArrowRight } from 'lucide-react'
import { Link, useLocation } from 'react-router'
import { Button } from '@/components/ui/Button'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { PRICING_ACTION, topicOf, type AssistantContext, type TopicId } from './assistant-kb'
import { AssistantFact } from './AssistantFacts'
import { CHAT_TOUCH } from './AssistantChips'

/** Câu trả lời của một chủ đề: các phần theo thứ tự của bộ câu trả lời, rồi liên kết xem thêm. */
export function TopicAnswer({ topicId, context, onNavigate, actionClassName }: {
  topicId: TopicId
  context: AssistantContext
  /** Bấm một liên kết (đóng tờ chat trên điện thoại trước khi điều hướng). */
  onNavigate?: () => void
  /** Cỡ của liên kết xem thêm khi câu trả lời nằm ngoài khung chat (phần Hỏi đáp: 56 px trên máy cảm ứng như mọi nút của trang công khai). */
  actionClassName?: string
}) {
  const t = useT()
  const { pathname } = useLocation()
  const topic = topicOf(topicId)
  // Đang ở Bảng giá thì không mời mở Bảng giá
  const actions = topic.actions(context).filter((action) => action.id !== PRICING_ACTION.id || pathname !== PRICING_ACTION.to)
  const answer =
    topicId === 'start' && context.selfSignUp ? t('assistant.topics.start.answerSelf') : t(`assistant.topics.${topicId}.answer`)

  return (
    <div className="flex flex-col gap-2">
      {topic.parts(context).map((part) => (part === 'answer' ? <p key={part} className="m-0">{answer}</p> : <AssistantFact key={part} id={part} />))}
      {actions.length > 0 ? (
        <div role="group" aria-label={t('assistant.actions.label')} className="flex flex-wrap gap-2 pt-1">
          {actions.map((action) => (
            <Button key={action.id} asChild variant="secondary" size="sm" className={cn('pointer-coarse:h-12', CHAT_TOUCH, actionClassName)}>
              <Link to={action.to} onClick={onNavigate}>
                {t(`assistant.actions.${action.id}`)}
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
