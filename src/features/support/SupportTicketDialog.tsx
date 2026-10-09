import { zodResolver } from '@hookform/resolvers/zod'
import { ChevronLeft, LifeBuoy, Plus, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { SelectField } from '@/components/ui/SelectField'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/Textarea'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'
import { TICKET_KINDS, type SupportTicket } from '@/lib/mock-db'
import { ticketFormSchema, translateSupportError, type TicketFormValues } from './support-form'
import { TicketKindBadge, TicketStatusBadge } from './TicketBadges'
import { TicketThread } from './TicketThread'
import { useCreateTicketMutation, useReplyMutation, useSupportTicketsQuery } from './useSupportQuery'

/** Cỡ cảm ứng cho kho và tài xế mở hộp thoại từ nút tài khoản 56 px (AGENTS mục 5, 10). */
const TOUCH_BUTTON = 'pointer-coarse:h-14 pointer-coarse:text-body-lg'

type View = { kind: 'list' } | { kind: 'new' } | { kind: 'ticket'; id: string }

function TicketRow({ ticket, onOpen }: { ticket: SupportTicket; onOpen: () => void }) {
  const t = useT()
  const format = useFormat()
  return (
    <li>
      <button
        type="button"
        aria-label={t('support.mine.open', { title: ticket.title })}
        onClick={onOpen}
        className="flex w-full min-w-0 flex-col gap-1.5 rounded-md border border-border bg-bg px-3.5 py-3 text-left transition-colors duration-(--dur-fast) ease-standard hover:border-cyan-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary pointer-coarse:py-4"
      >
        <span className="flex flex-wrap items-center gap-2">
          <TicketStatusBadge status={ticket.status} />
          <TicketKindBadge kind={ticket.kind} />
          <span className="font-mono text-caption text-ink-3">{ticket.id}</span>
        </span>
        <span className="font-medium text-ink-strong pointer-coarse:text-body-lg">{ticket.title}</span>
        <span className="text-small text-ink-3 pointer-coarse:text-body">
          {t('support.mine.replies', { count: ticket.replies.length })} · {t('support.mine.updated', { time: `${format.date(ticket.updatedAt)} ${format.time(ticket.updatedAt)}` })}
        </span>
      </button>
    </li>
  )
}

function NewTicketForm({ onBack, onSent, pending, send }: {
  onBack: () => void
  onSent: (ticket: SupportTicket) => void
  pending: boolean
  send: (values: TicketFormValues) => Promise<SupportTicket>
}) {
  const t = useT()
  const [serverError, setServerError] = useState<unknown>(null)
  const form = useForm<TicketFormValues>({ resolver: zodResolver(ticketFormSchema), defaultValues: { kind: 'TECHNICAL', title: '', description: '' } })
  const { errors } = form.formState

  async function handleValid(values: TicketFormValues) {
    setServerError(null)
    try {
      onSent(await send(values))
    } catch (error) {
      setServerError(error)
    }
  }

  return (
    <form noValidate onSubmit={form.handleSubmit(handleValid)} className="flex flex-col gap-4">
      <SelectField
        control={form.control}
        name="kind"
        label={t('support.form.kind')}
        options={TICKET_KINDS.map((kind) => ({ value: kind, label: t(`support.kinds.${kind}`) }))}
        className="pointer-coarse:[&_button]:h-14 pointer-coarse:[&_button]:text-body-lg"
      />
      <Input
        label={t('support.form.subject')}
        placeholder={t('support.form.subjectPlaceholder')}
        required
        className="pointer-coarse:h-14 pointer-coarse:text-body-lg"
        error={translateSupportError(t, errors.title?.message)}
        {...form.register('title')}
      />
      <Textarea
        label={t('support.form.body')}
        placeholder={t('support.form.bodyPlaceholder')}
        rows={5}
        className="pointer-coarse:text-body-lg"
        error={translateSupportError(t, errors.description?.message)}
        {...form.register('description')}
      />
      {serverError ? (
        <p role="alert" className="m-0 rounded-md border border-badge-danger-border bg-badge-danger-bg px-3 py-2 text-body text-badge-danger-fg">
          {dataErrorMessage(serverError, t)}
        </p>
      ) : null}
      <div className="flex justify-end gap-2.5">
        <Button type="button" variant="secondary" onClick={onBack} className={TOUCH_BUTTON}>{t('support.form.cancel')}</Button>
        <Button type="submit" variant="primary" loading={pending} className={TOUCH_BUTTON}>{t('support.form.send')}</Button>
      </div>
    </form>
  )
}

/**
 * "Yêu cầu hỗ trợ" của người dùng công ty (FE-8-07, `support.create`) — hộp thoại mở từ menu tài khoản của thanh điều hướng, hoặc từ nút
 * tài khoản 56 px ở màn chính của kho và tài xế. Ba màn trong một hộp: danh sách yêu cầu **do chính mình gửi** (kho chỉ trả những yêu
 * cầu đó), gửi yêu cầu mới (loại, tiêu đề, mô tả), và cuộc trao đổi của một yêu cầu để đọc và trả lời thêm. Mở lại luôn bắt đầu từ danh
 * sách. Nơi gọi chỉ gắn hộp thoại khi mở.
 */
export function SupportTicketDialog({ onClose }: { onClose: () => void }) {
  const t = useT()
  const query = useSupportTicketsQuery()
  const create = useCreateTicketMutation()
  const reply = useReplyMutation()
  const [view, setView] = useState<View>({ kind: 'list' })
  const tickets = query.data ?? []
  const current = view.kind === 'ticket' ? tickets.find((ticket) => ticket.id === view.id) : undefined

  const back = (
    <Button type="button" variant="ghost" size="sm" onClick={() => setView({ kind: 'list' })} className="-ml-2 self-start pointer-coarse:h-14 pointer-coarse:text-body-lg">
      <ChevronLeft strokeWidth={1.5} aria-hidden />
      {t('support.mine.back')}
    </Button>
  )

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="w-180">
        <DialogHeader icon={LifeBuoy} title={view.kind === 'new' ? t('support.form.title') : t('support.mine.title')} description={t('support.mine.description')} />
        <div className="flex max-h-[62vh] flex-col gap-4 overflow-y-auto px-7 py-5">
          {view.kind === 'new' ? (
            <>
              {back}
              <NewTicketForm
                onBack={() => setView({ kind: 'list' })}
                pending={create.isPending}
                send={(values) => create.mutateAsync(values)}
                onSent={(ticket) => {
                  toast.success(t('support.form.sent', { id: ticket.id }))
                  setView({ kind: 'ticket', id: ticket.id })
                }}
              />
            </>
          ) : view.kind === 'ticket' && current ? (
            <>
              {back}
              <TicketThread
                ticket={current}
                viewerIsSupport={false}
                pending={reply.isPending}
                onReply={async (text) => {
                  await reply.mutateAsync({ ticketId: current.id, text })
                  toast.success(t('support.thread.sent'))
                }}
              />
            </>
          ) : query.isPending ? (
            <div role="status" aria-label={t('support.mine.loading')} className="flex justify-center py-10"><Spinner /></div>
          ) : query.isError ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <p className="m-0 text-body text-ink-2">{dataErrorMessage(query.error, t)}</p>
              <Button variant="secondary" onClick={() => void query.refetch()} className={TOUCH_BUTTON}><RotateCcw strokeWidth={1.5} />{t('support.mine.retry')}</Button>
            </div>
          ) : (
            <>
              <Button variant="primary" className={`self-start ${TOUCH_BUTTON}`} onClick={() => setView({ kind: 'new' })}>
                <Plus strokeWidth={1.5} aria-hidden />
                {t('support.mine.new')}
              </Button>
              {tickets.length === 0 ? (
                <p className="m-0 py-6 text-center text-body text-ink-3 pointer-coarse:text-body-lg">{t('support.mine.empty')}</p>
              ) : (
                <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                  {tickets.map((ticket) => <TicketRow key={ticket.id} ticket={ticket} onOpen={() => setView({ kind: 'ticket', id: ticket.id })} />)}
                </ul>
              )}
            </>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary" className={TOUCH_BUTTON}>{t('support.mine.close')}</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
