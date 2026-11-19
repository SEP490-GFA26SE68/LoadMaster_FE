import { useEffect, useRef, type ReactNode } from 'react'
import { LUMO_NAME } from '@/components/brand/Lumo'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { FALLBACK_TOPICS, STARTER_TOPICS, topicOf, type AssistantContext, type TopicId } from './assistant-kb'
import type { AssistantEntry } from './assistant-session'
import { AdvisorAsk, AdvisorResult } from './AssistantAdvisor'
import { TopicAnswer } from './AssistantAnswer'
import { CHAT_TOUCH, HandoffButton, TopicChips } from './AssistantChips'

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

function Bubble({ who, children, mine = false }: { who: string; children: ReactNode; mine?: boolean }) {
  return (
    <div
      data-entry={mine ? 'user' : 'lumo'}
      className={cn(
        'flex max-w-[92%] flex-col gap-2 rounded-lg px-3.5 py-2.5',
        mine ? 'self-end bg-primary-bg text-ink-strong' : 'self-start border border-line-soft bg-surface text-ink-1',
      )}
    >
      <span className="sr-only">{who}: </span>
      {children}
    </div>
  )
}

function Typing() {
  const t = useT()
  return (
    <p className="m-0 flex items-center gap-2 self-start text-small text-ink-3">
      <span aria-hidden className="flex gap-1 motion-reduce:hidden">
        {[0, 1, 2].map((dot) => (
          <span key={dot} className="size-1.5 rounded-full bg-ink-3 animate-[lm-pulse_1s_ease-in-out_infinite]" style={{ animationDelay: `${dot * 160}ms` }} />
        ))}
      </span>
      {t('assistant.panel.typing', { name: LUMO_NAME })}
    </p>
  )
}

/**
 * Cuộc trò chuyện: câu mở đầu nói Lumo trả lời từ tài liệu (không phải nhân viên), câu hỏi gợi ý, rồi từng lượt hỏi — đáp. Chỉ lượt đáp cuối
 * mang gợi ý hỏi tiếp và lối "Chưa đúng ý? Hỏi đội LoadMaster". `role="log"`: lượt mới được đọc lên lịch sự. Có lượt mới thì cuộn sao cho
 * câu hỏi mới nhất nằm đầu vùng nhìn — câu trả lời dài vẫn đọc được từ đầu.
 */
export function AssistantLog({ entries, pending, context, onAsk, onRuns, onHandoff, onNavigate }: LogProps) {
  const t = useT()
  const scroller = useRef<HTMLDivElement>(null)
  const name = LUMO_NAME
  const last = entries.at(-1)

  useEffect(() => {
    const box = scroller.current
    if (!box) return
    const questions = box.querySelectorAll<HTMLElement>('[data-entry="user"]')
    const latest = questions.item(questions.length - 1)
    box.scrollTop = latest ? latest.offsetTop - 12 : 0
  }, [entries.length, pending])

  function followUps(topics: readonly TopicId[]) {
    return (
      <div className="flex flex-col gap-2 self-stretch">
        <HandoffButton onHandoff={onHandoff} />
        <TopicChips label={t('assistant.panel.followUps')} topics={topics} onAsk={onAsk} disabled={pending} />
      </div>
    )
  }

  function render(entry: AssistantEntry, isLast: boolean) {
    const says = t('assistant.panel.says', { name })
    switch (entry.kind) {
      case 'user':
        return <Bubble key={entry.id} mine who={t('assistant.panel.you')}><p className="m-0">{entry.text}</p></Bubble>
      case 'answer': {
        const advisorAsk = entry.topicId === 'advisor' && isLast
        return (
          <div key={entry.id} className="contents">
            <Bubble who={says}>
              <TopicAnswer topicId={entry.topicId} context={context} onNavigate={onNavigate} />
              {advisorAsk ? <AdvisorAsk onRuns={onRuns} disabled={pending} /> : null}
            </Bubble>
            {isLast && !pending && !advisorAsk ? followUps(topicOf(entry.topicId).followUps) : null}
          </div>
        )
      }
      case 'advisor':
        return (
          <div key={entry.id} className="contents">
            <Bubble who={says}><AdvisorResult runs={entry.runs} onHandoff={onHandoff} /></Bubble>
            {isLast && !pending ? followUps(ADVISOR_FOLLOW_UPS) : null}
          </div>
        )
      case 'fallback':
        return (
          <div key={entry.id} className="contents">
            <Bubble who={says}>
              <p className="m-0">{t('assistant.fallback')}</p>
              <HandoffButton strong onHandoff={onHandoff} />
            </Bubble>
            {isLast && !pending ? <TopicChips label={t('assistant.panel.followUps')} topics={FALLBACK_TOPICS} onAsk={onAsk} /> : null}
          </div>
        )
      case 'error':
        return <Bubble key={entry.id} who={says}><p className="m-0">{t('assistant.panel.error')}</p></Bubble>
    }
  }

  return (
    <div ref={scroller} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
      <div role="log" aria-live="polite" aria-label={t('assistant.panel.log', { name })} className={cn('flex flex-col gap-3 text-body', CHAT_TOUCH)}>
        <Bubble who={t('assistant.panel.says', { name })}>
          <p className="m-0 font-medium text-ink-strong">{t('assistant.panel.intro', { name })}</p>
          <p className="m-0">{t('assistant.panel.introHint')}</p>
        </Bubble>
        {entries.length === 0 ? <TopicChips label={t('assistant.panel.starters')} topics={STARTER_TOPICS} onAsk={onAsk} disabled={pending} /> : null}
        {entries.map((entry) => render(entry, entry === last))}
        {pending ? <Typing /> : null}
      </div>
    </div>
  )
}
