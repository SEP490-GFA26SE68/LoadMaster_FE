import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'
import type { SupportTicket } from '@/lib/mock-db'
import { cn } from '@/lib/utils'
import { replyFormSchema, translateSupportError, type ReplyFormValues } from './support-form'
import { TicketKindBadge, TicketStatusBadge } from './TicketBadges'

/** Cỡ cảm ứng cho kho và tài xế mở hộp thoại từ nút tài khoản 56 px (AGENTS mục 5, 10): nút 56 px, chữ từ 16 px. */
const TOUCH_BUTTON = 'pointer-coarse:h-14 pointer-coarse:text-body-lg'

function ReplyForm({ onReply, pending }: { onReply: (text: string) => Promise<void>; pending: boolean }) {
  const t = useT()
  const [serverError, setServerError] = useState<unknown>(null)
  const form = useForm<ReplyFormValues>({ resolver: zodResolver(replyFormSchema), defaultValues: { text: '' } })
  const { errors } = form.formState

  async function handleValid({ text }: ReplyFormValues) {
    setServerError(null)
    try {
      await onReply(text)
      form.reset({ text: '' })
    } catch (error) {
      setServerError(error)
    }
  }

  return (
    <form noValidate onSubmit={form.handleSubmit(handleValid)} className="flex flex-col gap-3">
      <Textarea
        label={t('support.thread.reply')}
        placeholder={t('support.thread.replyPlaceholder')}
        rows={3}
        className="pointer-coarse:text-body-lg"
        error={translateSupportError(t, errors.text?.message)}
        {...form.register('text')}
      />
      {serverError ? (
        <p role="alert" className="m-0 rounded-md border border-badge-danger-border bg-badge-danger-bg px-3 py-2 text-body text-badge-danger-fg">
          {dataErrorMessage(serverError, t)}
        </p>
      ) : null}
      <div className="flex justify-end">
        <Button type="submit" variant="primary" loading={pending} className={TOUCH_BUTTON}>{t('support.thread.send')}</Button>
      </div>
    </form>
  )
}

/**
 * Cuộc trao đổi của một yêu cầu hỗ trợ (FE-8-07), dùng chung cho hộp thoại của người dùng công ty và màn `/ho-tro`: tiêu đề, loại,
 * trạng thái, nội dung yêu cầu, các lần trả lời theo thứ tự, rồi ô trả lời. Yêu cầu đã đóng không có ô trả lời mà có một câu nói lý do
 * (Hỗ trợ khách hàng mở lại bằng ô trạng thái ở màn của họ). Lần trả lời của Hỗ trợ khách hàng nền tint để người gửi nhận ra ngay.
 */
export function TicketThread({ ticket, viewerIsSupport, onReply, pending }: {
  ticket: SupportTicket
  viewerIsSupport: boolean
  onReply: (text: string) => Promise<void>
  pending: boolean
}) {
  const t = useT()
  const format = useFormat()
  const when = (iso: string) => `${format.date(iso)} ${format.time(iso)}`
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <TicketStatusBadge status={ticket.status} />
          <TicketKindBadge kind={ticket.kind} />
          <span className="font-mono text-caption text-ink-3">{ticket.id}</span>
        </div>
        <h3 className="m-0 font-display text-h3 leading-6 font-semibold text-ink-strong pointer-coarse:text-body-lg">{ticket.title}</h3>
        <p className="m-0 text-small text-ink-3">{t('support.thread.sentBy', { name: ticket.senderName, time: when(ticket.createdAt) })}</p>
      </div>

      <section aria-label={t('support.thread.body')} className="rounded-md border border-line-soft bg-n-25 px-3.5 py-3">
        <p className="m-0 whitespace-pre-wrap text-body text-ink-1 pointer-coarse:text-body-lg">{ticket.description}</p>
      </section>

      <section aria-label={t('support.thread.replies')} className="flex flex-col gap-2.5">
        {ticket.replies.length === 0 ? (
          <p className="m-0 text-small text-ink-3 pointer-coarse:text-body">{t('support.thread.noReplies')}</p>
        ) : (
          <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
            {ticket.replies.map((reply) => (
              <li
                key={`${reply.at}-${reply.authorId}`}
                className={cn('rounded-md border px-3.5 py-3', reply.authorRole === 'systemSupporter' ? 'border-cyan-200 bg-cyan-50' : 'border-line-soft bg-bg')}
              >
                <div className="mb-1 flex flex-wrap items-baseline gap-x-2 text-small text-ink-3 pointer-coarse:text-body">
                  <span className="font-medium text-ink-1">{t('support.thread.author', { name: reply.authorName, role: t(`roles.${reply.authorRole}`) })}</span>
                  <time dateTime={reply.at} className="tabular-nums">{when(reply.at)}</time>
                </div>
                <p className="m-0 whitespace-pre-wrap text-body text-ink-1 pointer-coarse:text-body-lg">{reply.text}</p>
              </li>
            ))}
          </ol>
        )}
      </section>

      {ticket.status === 'CLOSED' ? (
        <p className="m-0 text-small text-ink-2 pointer-coarse:text-body">{viewerIsSupport ? t('support.thread.closedSupport') : t('support.thread.closed')}</p>
      ) : (
        <ReplyForm key={ticket.id} onReply={onReply} pending={pending} />
      )}
    </div>
  )
}
