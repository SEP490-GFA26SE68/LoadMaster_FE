import {
  Calculator,
  ClipboardList,
  Coins,
  LifeBuoy,
  MessageCircleQuestion,
  PanelsTopLeft,
  Rocket,
  Tags,
  Truck,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { useId } from 'react'
import { LUMO_NAME } from '@/components/brand/Lumo'
import { Button } from '@/components/ui/Button'
import { useAuthSafe } from '@/features/auth/AuthProvider'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { appStartersFor, type AppStarterId } from './app-starters'
import { STARTER_TOPICS, type TopicId } from './assistant-kb'
import { useAssistantSurface } from './assistant-surface'
import { briefingAvailable } from './briefing-api'
import { AssistantAvatar } from './AssistantAvatar'
import { CHAT_TOUCH } from './AssistantChips'

/** Icon của từng câu hỏi gợi ý — chỉ để nhìn, chữ của câu hỏi là tên truy cập. Chủ đề chưa có icon dùng dấu hỏi. */
const STARTER_ICONS: Partial<Record<TopicId, LucideIcon>> = {
  plans: Tags,
  credit: Coins,
  start: Rocket,
  advisor: Calculator,
}

const APP_STARTER_ICONS: Record<AppStarterId, LucideIcon> = {
  page: PanelsTopLeft,
  trips: Truck,
  credit: Coins,
  payroll: Wallet,
  tickets: LifeBuoy,
  plans: Tags,
}

type Starter = { readonly key: string; readonly question: string; readonly icon: LucideIcon; readonly topicId?: TopicId }

/**
 * Màn chào của khung chat khi chưa hỏi gì: Lumo (`idea` — gợi ý) chào một câu, nói hỏi được gì, rồi tối đa bốn câu hỏi gợi ý thành lưới
 * 2 × 2 lấp chỗ trống của khung. Trang công khai: bốn chủ đề soạn sẵn (bấm là hỏi đúng chủ đề đó). Trong ứng dụng: câu theo vai trò
 * (`appStartersFor`), gửi cho mô hình như câu gõ; điều phối viên và quản lý công ty có thêm nút phụ "Tóm tắt hôm nay" (`onBriefing`, chỉ
 * gọi máy chủ khi bấm). Hỏi rồi thì màn chào nhường chỗ cho cuộc trò chuyện. Ô là nút: rê chuột chỉ đổi nền và viền, không nâng ô.
 */
export function AssistantWelcome({ onAsk, onBriefing, disabled }: {
  onAsk: (question: string, topicId?: TopicId) => void
  onBriefing?: (label: string) => void
  disabled?: boolean
}) {
  const t = useT()
  const headingId = useId()
  const inApp = useAssistantSurface() === 'app'
  const role = useAuthSafe()?.user?.role
  const briefing = inApp && onBriefing !== undefined && briefingAvailable(role) ? onBriefing : null
  const starters: Starter[] =
    inApp && role
      ? appStartersFor(role).map((id) => ({ key: id, question: t(`assistant.panel.appStarters.${id}`), icon: APP_STARTER_ICONS[id] }))
      : STARTER_TOPICS.map((id) => ({
          key: id,
          question: t(`assistant.topics.${id}.chip`),
          icon: STARTER_ICONS[id] ?? MessageCircleQuestion,
          topicId: id,
        }))
  return (
    <section aria-labelledby={headingId} className="my-auto flex flex-col gap-4 py-2">
      <div className="flex items-center gap-3">
        <AssistantAvatar pose="idea" size="lg" />
        <div className="flex min-w-0 flex-col gap-1">
          <h3 id={headingId} className="m-0 font-display text-h2 font-[650] font-stretch-108% text-ink-strong">
            {t('assistant.panel.greeting', { name: LUMO_NAME })}
          </h3>
          <p className="m-0 text-small text-ink-2 pointer-coarse:text-body-lg">{t(inApp ? 'assistant.panel.introHintApp' : 'assistant.panel.introHint')}</p>
        </div>
      </div>
      {briefing !== null ? (
        <Button
          type="button"
          variant="secondary"
          disabled={disabled}
          className={cn('self-start pointer-coarse:h-12', CHAT_TOUCH)}
          onClick={() => briefing(t('assistant.briefing.button'))}
        >
          <ClipboardList aria-hidden />
          {t('assistant.briefing.button')}
        </Button>
      ) : null}
      <div role="group" aria-label={t('assistant.panel.starters')} className="grid grid-cols-2 gap-2">
        {starters.map(({ key, question, icon: Icon, topicId }) => (
          <button
            key={key}
            type="button"
            disabled={disabled}
            onClick={() => onAsk(question, topicId)}
            className={cn(
              'flex flex-col items-start gap-1.5 rounded-lg border border-line-soft bg-surface p-3 text-left text-small font-medium text-ink-1',
              'transition-colors duration-(--dur-fast) hover:border-cyan-300 hover:bg-primary-bg',
              'disabled:cursor-not-allowed disabled:text-text-disabled',
              'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
              CHAT_TOUCH,
            )}
          >
            <span aria-hidden className="flex size-7 flex-none items-center justify-center rounded-md bg-tint-blue text-tint-blue-fg">
              <Icon className="size-4" strokeWidth={1.5} />
            </span>
            <span>{question}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
