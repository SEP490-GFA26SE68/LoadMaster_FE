import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'
import { canOpenRoute } from '@/app/route-access'
import { Button } from '@/components/ui/Button'
import { useAuthSafe } from '@/features/auth/AuthProvider'
import { can } from '@/features/auth/permissions'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { AssistantLink } from './assistant-api'
import { openableLinks } from './assistant-links'
import type { AssistantEntry } from './assistant-session'
import { answerBlocks, type AnswerBlock } from './assistant-text'
import { CHAT_TOUCH } from './AssistantChips'

type AiEntry = Extract<AssistantEntry, { kind: 'ai' }>

const ACTION = cn('pointer-coarse:h-12 in-[.assistant-touch]:h-14', CHAT_TOUCH)

function Block({ block }: { block: AnswerBlock }) {
  if (block.kind === 'paragraph') return <p className="m-0 whitespace-pre-line">{block.text}</p>
  const List = block.kind === 'bullets' ? 'ul' : 'ol'
  return (
    <List className={cn('m-0 flex flex-col gap-1 pl-5', block.kind === 'bullets' ? 'list-disc' : 'list-decimal')}>
      {block.items.map((item, index) => <li key={index}>{item}</li>)}
    </List>
  )
}

/** Câu soạn sẵn thay cho câu của mô hình (máy chủ bận, hết ngân sách, không tới được): một dòng nói rõ, đứng đầu câu trả lời. */
export function DegradedNote() {
  const t = useT()
  return <p className="m-0 text-small text-ink-3 in-[.assistant-touch]:text-body-lg">{t('assistant.ai.degraded')}</p>
}

/**
 * Liên kết máy chủ gợi ý dưới một câu trả lời (của mô hình hay bản tin): chỉ giữ đường dẫn trong app mà người xem mở được (bảng route thật
 * và quyền của vai trò — `openableLinks`, `canOpenRoute`); không còn liên kết nào thì không vẽ gì.
 */
export function AnswerLinks({ links, onNavigate }: { links: readonly AssistantLink[]; onNavigate?: () => void }) {
  const t = useT()
  const role = useAuthSafe()?.user?.role
  const openable = openableLinks(links, (to) => canOpenRoute(to, (permission) => can(role, permission)))
  if (openable.length === 0) return null
  return (
    <div role="group" aria-label={t('assistant.ai.links')} className="flex flex-wrap gap-2 pt-1">
      {openable.map((link) => (
        <Button key={link.to} asChild variant="secondary" size="sm" className={ACTION}>
          <Link to={link.to} onClick={onNavigate}>
            {link.label}
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      ))}
    </div>
  )
}

/**
 * Câu trả lời của mô hình. Chữ vẽ bằng phần tử thường (`answerBlocks`), không bao giờ là HTML của mô hình; liên kết qua `AnswerLinks`.
 * Trợ lý hỏi có chuyển cho đội hỗ trợ không thì lượt cuối có hai nút trả lời, bấm là gửi câu đó như người dùng gõ; yêu cầu hỗ trợ đã tạo
 * thì có một dòng kèm mã.
 * Lệnh giao diện (`uiActions`) chưa dùng ở đây.
 */
export function AiAnswer({ entry, isLast, pending, onAsk, onNavigate }: {
  entry: AiEntry
  isLast: boolean
  pending: boolean
  onAsk: (question: string) => void
  onNavigate?: () => void
}) {
  const t = useT()
  const { offered, ticketCode } = entry.handoff

  return (
    <div className="flex flex-col gap-2">
      {answerBlocks(entry.text).map((block, index) => <Block key={index} block={block} />)}
      {ticketCode !== null ? <p className="m-0 font-medium">{t('assistant.ai.ticket', { code: ticketCode })}</p> : null}
      <AnswerLinks links={entry.links} onNavigate={onNavigate} />
      {offered && ticketCode === null && isLast ? (
        <div role="group" aria-label={t('assistant.ai.handoffQuestion')} className="flex flex-wrap gap-2 pt-1">
          <Button type="button" variant="secondary" size="sm" disabled={pending} className={ACTION} onClick={() => onAsk(t('assistant.ai.handoffYesMessage'))}>
            {t('assistant.ai.handoffYes')}
          </Button>
          <Button type="button" variant="ghost" size="sm" disabled={pending} className={ACTION} onClick={() => onAsk(t('assistant.ai.handoffNoMessage'))}>
            {t('assistant.ai.handoffNo')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
