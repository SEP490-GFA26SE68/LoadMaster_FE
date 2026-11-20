import { useEffect, useRef, type ReactNode } from 'react'
import { LUMO_NAME } from '@/components/brand/Lumo'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { FALLBACK_TOPICS, topicOf, type AssistantContext, type TopicId } from './assistant-kb'
import type { AssistantEntry } from './assistant-session'
import { useAssistantSurface } from './assistant-surface'
import { AdvisorAsk, AdvisorResult } from './AssistantAdvisor'
import { AiAnswer, DegradedNote } from './AssistantAiAnswer'
import { TopicAnswer } from './AssistantAnswer'
import { AssistantAvatar } from './AssistantAvatar'
import { CHAT_TOUCH, HandoffButton, TopicChips } from './AssistantChips'
import { AssistantWelcome } from './AssistantWelcome'

/** Sau phép tính gói: tính lại, xem gói, dùng thử. */
const ADVISOR_FOLLOW_UPS: readonly TopicId[] = ['advisor', 'plans', 'start']

type LogProps = {
  entries: readonly AssistantEntry[]
  pending: boolean
  context: AssistantContext
  onAsk: (question: string, topicId?: TopicId) => void
  onRuns: (label: string, runs: number) => void
  onHandoff: () => void
  onNavigate?: () => void
}

/** Câu hỏi của khách: dồn phải, nền cyan nhạt. */
function UserBubble({ who, text }: { who: string; text: string }) {
  return (
    <div data-entry="user" className="flex max-w-[88%] flex-col self-end rounded-lg bg-primary-bg px-3.5 py-2.5 text-ink-strong">
      <span className="sr-only">{who}: </span>
      <p className="m-0">{text}</p>
    </div>
  )
}

/** Câu trả lời của Lumo: ảnh Lumo nhỏ bên trái, bong bóng nền surface. */
function LumoBubble({ who, children }: { who: string; children: ReactNode }) {
  return (
    <div data-entry="lumo" className="flex max-w-full items-start gap-2 self-start">
      <AssistantAvatar pose="explain" size="xs" />
      <div className="flex min-w-0 flex-col gap-2 rounded-lg border border-line-soft bg-surface px-3.5 py-2.5 text-ink-1">
        <span className="sr-only">{who}: </span>
        {children}
      </div>
    </div>
  )
}

/** "Lumo đang trả lời…": chữ ánh gradient trợ lý chạy ngang (`assistant-shimmer`); giảm chuyển động thì chữ xám đứng yên. */
function Typing() {
  const t = useT()
  return (
    <p className="m-0 flex items-center gap-2 self-start text-small">
      <AssistantAvatar pose="explain" size="xs" />
      <span className="assistant-shimmer font-medium">{t('assistant.panel.typing', { name: LUMO_NAME })}</span>
    </p>
  )
}

/**
 * Cuộc trò chuyện. Chưa hỏi gì thì là màn chào (`AssistantWelcome`); rồi từng lượt hỏi — đáp, câu trả lời có ảnh Lumo nhỏ bên trái. Chỉ
 * lượt đáp cuối mang gợi ý hỏi tiếp và lối "Chưa đúng ý? Hỏi đội LoadMaster". `role="log"`: lượt mới được đọc lên lịch sự. Có lượt mới thì
 * cuộn sao cho câu hỏi mới nhất nằm đầu vùng nhìn — câu trả lời dài vẫn đọc được từ đầu. Bấm một nút gợi ý thì nút đó biến mất cùng lượt
 * cũ: focus chuyển vào vùng trò chuyện (không mở bàn phím ảo như khi về ô gõ) để Esc vẫn đóng khung và trình đọc màn hình không lạc.
 */
export function AssistantLog({ entries, pending, context, onAsk, onRuns, onHandoff, onNavigate }: LogProps) {
  const t = useT()
  const scroller = useRef<HTMLDivElement>(null)
  const log = useRef<HTMLDivElement>(null)
  const name = LUMO_NAME
  const last = entries.at(-1)
  // Lối "Hỏi đội LoadMaster" mở form liên hệ của trang giới thiệu: chỉ cho khách; trong ứng dụng trợ lý tự mời chuyển cho đội hỗ trợ
  const guest = useAssistantSurface() === 'public'

  useEffect(() => {
    const box = scroller.current
    if (!box) return
    const questions = box.querySelectorAll<HTMLElement>('[data-entry="user"]')
    const latest = questions.item(questions.length - 1)
    box.scrollTop = latest ? latest.offsetTop - 12 : 0
  }, [entries.length, pending])

  function ask(question: string, topicId?: TopicId) {
    onAsk(question, topicId)
    log.current?.focus({ preventScroll: true })
  }

  function runs(label: string, count: number) {
    onRuns(label, count)
    log.current?.focus({ preventScroll: true })
  }

  function followUps(topics: readonly TopicId[]) {
    return (
      <div className="flex flex-col gap-2 self-stretch pl-9">
        {guest ? <HandoffButton onHandoff={onHandoff} /> : null}
        <TopicChips label={t('assistant.panel.followUps')} topics={topics} onAsk={ask} disabled={pending} />
      </div>
    )
  }

  function render(entry: AssistantEntry, isLast: boolean) {
    const says = t('assistant.panel.says', { name })
    switch (entry.kind) {
      case 'user':
        return <UserBubble key={entry.id} who={t('assistant.panel.you')} text={entry.text} />
      case 'answer': {
        const advisorAsk = entry.topicId === 'advisor' && isLast
        return (
          <div key={entry.id} className="contents">
            <LumoBubble who={says}>
              {entry.degraded ? <DegradedNote /> : null}
              <TopicAnswer topicId={entry.topicId} context={context} onNavigate={onNavigate} />
              {advisorAsk ? <AdvisorAsk onRuns={runs} disabled={pending} /> : null}
            </LumoBubble>
            {isLast && !pending && !advisorAsk ? followUps(topicOf(entry.topicId).followUps) : null}
          </div>
        )
      }
      case 'advisor':
        return (
          <div key={entry.id} className="contents">
            <LumoBubble who={says}><AdvisorResult runs={entry.runs} onHandoff={onHandoff} /></LumoBubble>
            {isLast && !pending ? followUps(ADVISOR_FOLLOW_UPS) : null}
          </div>
        )
      case 'fallback':
        return (
          <div key={entry.id} className="contents">
            <LumoBubble who={says}>
              {entry.degraded ? <DegradedNote /> : null}
              <p className="m-0">{t('assistant.fallback')}</p>
              {guest ? <HandoffButton strong onHandoff={onHandoff} /> : null}
            </LumoBubble>
            {isLast && !pending ? (
              <div className="pl-9">
                <TopicChips label={t('assistant.panel.followUps')} topics={FALLBACK_TOPICS} onAsk={ask} />
              </div>
            ) : null}
          </div>
        )
      case 'ai':
        return (
          <div key={entry.id} className="contents">
            <LumoBubble who={says}>
              <AiAnswer entry={entry} isLast={isLast} pending={pending} onAsk={ask} onNavigate={onNavigate} />
            </LumoBubble>
            {isLast && !pending && guest ? <div className="pl-9"><HandoffButton onHandoff={onHandoff} /></div> : null}
          </div>
        )
      case 'error':
        return <LumoBubble key={entry.id} who={says}><p className="m-0">{t('assistant.panel.error')}</p></LumoBubble>
    }
  }

  return (
    <div ref={scroller} className="relative flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 py-4">
      {entries.length === 0 ? <AssistantWelcome onAsk={ask} disabled={pending} /> : null}
      <div
        ref={log}
        tabIndex={-1}
        role="log"
        aria-live="polite"
        aria-label={t('assistant.panel.log', { name })}
        className={cn('flex flex-col gap-3 text-body outline-none', CHAT_TOUCH)}
      >
        {entries.map((entry) => render(entry, entry === last))}
        {pending ? <Typing /> : null}
      </div>
    </div>
  )
}
