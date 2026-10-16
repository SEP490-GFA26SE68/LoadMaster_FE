import { zodResolver } from '@hookform/resolvers/zod'
import { X } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useForm, useFormState, useWatch, type Control } from 'react-hook-form'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { SelectField } from '@/components/ui/SelectField'
import { Textarea } from '@/components/ui/Textarea'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'
import { CONTACT_LIMITS, CONTACT_STATUSES, type GuestContact } from '@/lib/mock-db'
import { ContactStatusBadge, ContactTypeBadge } from './ContactBadges'
import { ContactPlan } from './ContactPlan'
import type { ContactRow } from './contact-list'
import {
  contactPanelSchema,
  contactPanelValues,
  contactPatch,
  mailtoHref,
  NO_ASSIGNEE,
  NOTE_TOO_LONG,
  type ContactPanelDirty,
  type ContactPanelValues,
} from './contact-panel-form'
import type { ContactHandler } from './contacts-api'
import { useUpdateContactMutation } from './useContactsQuery'

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-small text-ink-3">{label}</dt>
      <dd className="m-0 min-w-0 break-words text-body text-ink-1">{children}</dd>
    </div>
  )
}

/**
 * Nút lưu đọc giá trị đang nhập (`useWatch`) và ô đã sửa (`useFormState`) trong component con: thân form không vẽ lại theo từng phím.
 * Chưa sửa gì, hoặc chỗ đã sửa trùng với kho, thì mờ kèm lý do.
 */
function SaveButton({ control, contact, pending }: { control: Control<ContactPanelValues>; contact: GuestContact; pending: boolean }) {
  const t = useT()
  const reasonId = useId()
  const [status, assignee, note] = useWatch({ control, name: ['status', 'assignee', 'note'] })
  const { dirtyFields } = useFormState({ control })
  const unchanged = Object.keys(contactPatch(contact, { status, assignee, note }, dirtyFields)).length === 0
  return (
    <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1.5">
      {unchanged ? <span id={reasonId} className="text-small text-ink-3">{t('contacts.panel.unchanged')}</span> : null}
      <Button type="submit" loading={pending} disabled={unchanged} aria-describedby={unchanged ? reasonId : undefined}>
        {t('contacts.panel.save')}
      </Button>
    </div>
  )
}

/**
 * Khung bên phải của `/lien-he-khach` (`?lien-he=<mã>`): thông tin khách gửi, nội dung, và phần xử lý — trạng thái, người nhận việc (ba
 * vai trò nền tảng đang hoạt động), ghi chú nội bộ. "Lưu thay đổi" là nút chính duy nhất của màn và chỉ gửi ô người dùng đã sửa: kho trả
 * bản mới của yêu cầu (người khác vừa lưu) thì ô chưa sửa theo kho, ô đang sửa giữ nguyên. Mở ra và lưu xong thì tiêu đề nhận focus:
 * liên kết vừa bấm trong bảng bị dựng lại khi bảng gọn cột, nút Lưu vừa mờ đi.
 */
export function ContactPanel({ row, handlers, handlersError, onClose }: {
  row: ContactRow
  handlers: readonly ContactHandler[]
  /** Danh sách người nhận việc tải lỗi: ô chỉ còn người đang nhận, kèm gợi ý tải lại. */
  handlersError: boolean
  onClose: () => void
}) {
  const t = useT()
  const format = useFormat()
  const { contact } = row
  const update = useUpdateContactMutation()
  const headingId = useId()
  const headingRef = useRef<HTMLHeadingElement>(null)
  // Mở khung (lần vẽ đầu) và mỗi lần lưu xong: tiêu đề nhận focus
  const [focusRequest, setFocusRequest] = useState(0)
  useEffect(() => headingRef.current?.focus(), [focusRequest])
  const form = useForm<ContactPanelValues>({ resolver: zodResolver(contactPanelSchema), defaultValues: contactPanelValues(contact) })
  // Bản mới của yêu cầu từ kho: giá trị gốc của form theo kho, ô người dùng đang sửa giữ chữ đang nhập
  useEffect(() => form.reset(contactPanelValues(contact), { keepDirtyValues: true }), [contact, form])

  const assigneeOptions = [
    { value: NO_ASSIGNEE, label: t('contacts.panel.unassigned') },
    ...handlers.map((handler) => ({ value: handler.id, label: `${handler.name} · ${t(`roles.${handler.role}`)}` })),
    // Người đang nhận việc nhưng không còn nhận được (tài khoản đã khoá): vẫn hiện tên, không chọn lại được
    ...(contact.assignedToId !== undefined && !handlers.some((handler) => handler.id === contact.assignedToId)
      ? [{ value: contact.assignedToId, label: contact.assignedToName ?? contact.assignedToId, disabled: true }]
      : []),
  ]

  function handleValid(values: ContactPanelValues) {
    // `getFieldState` đọc trạng thái hiện thời của form, không phải bản của lần vẽ trước
    const dirty: ContactPanelDirty = {
      status: form.getFieldState('status').isDirty,
      assignee: form.getFieldState('assignee').isDirty,
      note: form.getFieldState('note').isDirty,
    }
    update.mutate({ contactId: contact.id, patch: contactPatch(contact, values, dirty) }, {
      onSuccess: (saved) => {
        form.reset(contactPanelValues(saved))
        toast.success(t('contacts.panel.saved', { id: saved.id }))
        setFocusRequest((request) => request + 1)
      },
      onError: (error) => toast.error(dataErrorMessage(error, t)),
    })
  }

  const noteError = form.formState.errors.note?.message === NOTE_TOO_LONG ? t(NOTE_TOO_LONG, { max: CONTACT_LIMITS.note }) : undefined
  const notGiven = <span className="text-ink-3">{t('contacts.panel.notGiven')}</span>

  return (
    <Card role="region" aria-labelledby={headingId} className="flex flex-col">
      <div className="flex items-start gap-3 border-b border-line-soft px-4.5 py-3.5">
        <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
          <h2 id={headingId} ref={headingRef} tabIndex={-1} className="m-0 font-display text-h3 leading-5.5 font-[650] break-words text-ink-strong outline-none font-stretch-106%">
            {contact.fullName}
          </h2>
          <ContactStatusBadge status={contact.status} />
        </div>
        <Button variant="ghost" size="icon" aria-label={t('contacts.panel.close')} onClick={onClose}>
          <X aria-hidden strokeWidth={1.5} />
        </Button>
      </div>

      <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-3 border-b border-line-soft px-4.5 py-4">
        <Detail label={t('contacts.panel.code')}><span className="font-mono text-caption">{contact.id}</span></Detail>
        <Detail label={t('contacts.panel.type')}><ContactTypeBadge type={contact.requestType} /></Detail>
        <Detail label={t('contacts.panel.received')}>{`${format.date(contact.createdAt)} ${format.time(contact.createdAt)}`}</Detail>
        <Detail label={t('contacts.panel.resolved')}>
          {contact.resolvedAt === undefined
            ? <span className="text-ink-3">{t('contacts.panel.notResolved')}</span>
            : `${format.date(contact.resolvedAt)} ${format.time(contact.resolvedAt)}`}
        </Detail>
        <div className="col-span-2">
          <Detail label={t('contacts.panel.email')}>
            <a href={mailtoHref(contact.email)} className="break-all text-primary underline-offset-2 hover:underline">{contact.email}</a>
          </Detail>
        </div>
        <Detail label={t('contacts.panel.phone')}>
          {contact.phoneNumber ? <span className="font-mono text-caption tabular-nums">{contact.phoneNumber}</span> : notGiven}
        </Detail>
        <Detail label={t('contacts.panel.plan')}><ContactPlan row={row} /></Detail>
        <div className="col-span-2">
          <Detail label={t('contacts.panel.company')}>{contact.companyName ?? notGiven}</Detail>
        </div>
      </dl>

      <div className="flex flex-col gap-1.5 border-b border-line-soft px-4.5 py-4">
        <h3 className="m-0 text-small font-semibold text-ink-2">{t('contacts.panel.message')}</h3>
        {contact.message
          ? <p className="m-0 text-body break-words whitespace-pre-wrap text-ink-1">{contact.message}</p>
          : <p className="m-0 text-body text-ink-3">{t('contacts.panel.noMessage')}</p>}
      </div>

      <form noValidate onSubmit={form.handleSubmit(handleValid)} className="flex flex-col gap-4 px-4.5 py-4" aria-labelledby={`${headingId}-xu-ly`}>
        <h3 id={`${headingId}-xu-ly`} className="m-0 text-small font-semibold text-ink-2">{t('contacts.panel.handling')}</h3>
        <SelectField
          control={form.control}
          name="status"
          label={t('contacts.panel.status')}
          options={CONTACT_STATUSES.map((status) => ({ value: status, label: t(`contacts.statuses.${status}`) }))}
        />
        <SelectField
          control={form.control}
          name="assignee"
          label={t('contacts.panel.assignee')}
          options={assigneeOptions}
          hint={handlersError ? t('contacts.panel.handlersError') : undefined}
        />
        <Textarea label={t('contacts.panel.note')} hint={t('contacts.panel.noteHint')} rows={4} error={noteError} {...form.register('note')} />
        <SaveButton control={form.control} contact={contact} pending={update.isPending} />
      </form>
    </Card>
  )
}
