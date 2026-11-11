import { zodResolver } from '@hookform/resolvers/zod'
import { KeyRound } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'
import type { SupportTicket } from '@/lib/mock-db'
import { cn } from '@/lib/utils'
import { replyFormSchema, translateSupportError, type ReplyFormValues } from './support-form'
import { TicketKindBadge, TicketStatusBadge } from './TicketBadges'
import { ticketLabel } from './ticket-view'
import { SUPPORT_SOURCE } from './useSupportQuery'

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

function Replies({ ticket, when }: { ticket: SupportTicket; when: (iso: string) => string }) {
  const t = useT()
  return (
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
  )
}

/** Ghi chú chữ thường của đội hỗ trợ (backend ghi tay vào `resolutionNote`, không phải mảng trao đổi), chỉ đọc. */
function SupportNote({ note }: { note: string }) {
  const t = useT()
  return (
    <section aria-label={t('support.thread.supportNote')} className="rounded-md border border-cyan-200 bg-cyan-50 px-3.5 py-3">
      <p className="m-0 mb-1 text-small font-medium text-ink-1 pointer-coarse:text-body">{t('support.thread.supportNote')}</p>
      <p className="m-0 whitespace-pre-wrap text-body text-ink-1 pointer-coarse:text-body-lg">{note}</p>
    </section>
  )
}

/**
 * Cuộc trao đổi của một yêu cầu hỗ trợ (FE-8-07), dùng chung cho hộp thoại của người dùng công ty và màn `/ho-tro`: tiêu đề, loại,
 * trạng thái, nội dung yêu cầu, các lần trả lời theo thứ tự, rồi ô trả lời. Yêu cầu đã đóng không có ô trả lời mà có một câu nói lý do
 * (Hỗ trợ khách hàng mở lại bằng ô trạng thái ở màn của họ). Lần trả lời của Hỗ trợ khách hàng nền tint để người gửi nhận ra ngay.
 * Nối backend: trao đổi đọc từ `resolutionNote`; trường đó là chữ thường thì hiện như phản hồi của đội hỗ trợ, phía trên các lần trả lời.
 */
export function TicketThread({ ticket, viewerIsSupport, onReply, onUnlockTrial, pending }: {
  ticket: SupportTicket
  viewerIsSupport: boolean
  onReply: (text: string) => Promise<void>
  onUnlockTrial?: (staffNote?: string) => Promise<void>
  pending: boolean
}) {
  const t = useT()
  const format = useFormat()
  const when = (iso: string) => `${format.date(iso)} ${format.time(iso)}`
  const [openUnlockDialog, setOpenUnlockDialog] = useState(false)
  const [staffNote, setStaffNote] = useState('')
  const [unlocking, setUnlocking] = useState(false)

  const showUnlockAction =
    SUPPORT_SOURCE.trialUnlock &&
    viewerIsSupport &&
    ticket.kind === 'TRIAL_ACCOUNT_UNLOCK' &&
    ticket.status !== 'RESOLVED' &&
    ticket.status !== 'CLOSED'

  async function handleConfirmUnlock() {
    if (!onUnlockTrial) return
    setUnlocking(true)
    try {
      await onUnlockTrial(staffNote.trim() ? staffNote : undefined)
      setOpenUnlockDialog(false)
      setStaffNote('')
    } finally {
      setUnlocking(false)
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <TicketStatusBadge status={ticket.status} />
          <TicketKindBadge kind={ticket.kind} />
          <span className="font-mono text-caption text-ink-3">{ticketLabel(ticket)}</span>
        </div>
        <h3 className="m-0 font-display text-h3 leading-6 font-semibold text-ink-strong pointer-coarse:text-body-lg">{ticket.title}</h3>
        <p className="m-0 text-small text-ink-3">{t('support.thread.sentBy', { name: ticket.senderName, time: when(ticket.createdAt) })}</p>
        {ticket.status === 'IN_PROGRESS' && ticket.assignedToName ? (
          <p className="m-0 text-caption font-medium text-cyan-700">{t('support.thread.assignedTo', { name: ticket.assignedToName })}</p>
        ) : null}
      </div>

      {showUnlockAction ? (
        <div className="flex flex-col gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-medium text-ink-strong">
              <KeyRound className="size-4 text-amber-700" strokeWidth={1.5} />
              <span>{t('support.page.unlock.action')}</span>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pending || unlocking}
              onClick={() => setOpenUnlockDialog(true)}
            >
              {t('support.page.unlock.action')}
            </Button>
          </div>
          <p className="m-0 text-caption text-ink-2">
            {t('support.page.unlock.dialogDescription')}
          </p>

          <ConfirmDialog
            open={openUnlockDialog}
            onOpenChange={setOpenUnlockDialog}
            title={t('support.page.unlock.dialogTitle')}
            description={t('support.page.unlock.dialogDescription')}
            confirmLabel={t('support.page.unlock.confirm')}
            cancelLabel={t('support.page.unlock.cancel')}
            pending={unlocking}
            onConfirm={handleConfirmUnlock}
          >
            <div className="my-3 flex flex-col gap-1.5 text-left">
              <label htmlFor="unlock-staff-note" className="text-caption font-medium text-ink-2">
                {t('support.page.unlock.staffNoteLabel')}
              </label>
              <Textarea
                id="unlock-staff-note"
                rows={3}
                value={staffNote}
                onChange={(e) => setStaffNote(e.target.value)}
                placeholder={t('support.page.unlock.staffNotePlaceholder')}
              />
            </div>
          </ConfirmDialog>
        </div>
      ) : null}

      <section aria-label={t('support.thread.body')} className="rounded-md border border-line-soft bg-n-25 px-3.5 py-3">
        <p className="m-0 whitespace-pre-wrap text-body text-ink-1 pointer-coarse:text-body-lg">{ticket.description}</p>
      </section>

      {ticket.resolutionNote === undefined ? null : <SupportNote note={ticket.resolutionNote} />}
      {!SUPPORT_SOURCE.replies ? (
        <p className="m-0 text-small text-ink-2 pointer-coarse:text-body">{t('support.thread.statusOnly')}</p>
      ) : (
        <>
          <Replies ticket={ticket} when={when} />
          {ticket.status === 'CLOSED' ? (
            viewerIsSupport ? (
              <p className="m-0 rounded-md border border-n-300 bg-n-100 px-3.5 py-2.5 text-small text-ink-2 pointer-coarse:text-body">
                {t('support.thread.closedSupport')}
              </p>
            ) : (
              <div className="flex flex-col gap-1 rounded-md border border-n-300 bg-n-100 px-3.5 py-2.5">
                <p className="m-0 text-small font-medium text-ink-2 pointer-coarse:text-body">{t('support.thread.closed')}</p>
                <p className="m-0 text-caption text-ink-3">{t('support.thread.closedHint')}</p>
              </div>
            )
          ) : viewerIsSupport && ticket.lockedByOther ? (
            <p role="status" className="m-0 rounded-md border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-small text-amber-700 pointer-coarse:text-body">
              {t('support.thread.lockedByOther', { name: ticket.assignedToName ?? ticket.assignedToId ?? '' })}
            </p>
          ) : (
            <ReplyForm key={ticket.id} onReply={onReply} pending={pending} />
          )}
        </>
      )}
    </div>
  )
}
