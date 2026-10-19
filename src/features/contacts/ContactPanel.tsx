import { AlertCircle, CheckCircle2, Mail, PhoneOff, Send, UserCheck, X } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { useAuth } from '@/features/auth/AuthProvider'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'
import { CONTACT_LIMITS } from '@/lib/mock-db'
import { ContactStatusBadge, ContactTypeBadge } from './ContactBadges'
import { ContactPlan } from './ContactPlan'
import type { ContactRow } from './contact-list'
import { mailtoHref, NOTE_TOO_LONG } from './contact-panel-form'
import type { ContactHandler } from './contacts-api'
import { useForwardTrialMutation, useReplyContactMutation, useUpdateContactMutation } from './useContactsQuery'

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-small text-ink-3">{label}</dt>
      <dd className="m-0 min-w-0 break-words text-body text-ink-1">{children}</dd>
    </div>
  )
}

/**
 * Khung bên phải của `/lien-he-khach` (`?lien-he=<mã>`): thông tin khách gửi, nội dung, và phần xử lý — trạng thái, người nhận việc
 * Cuộn nội bộ trong phạm vi khung (`overscroll-contain`, `overflow-y-auto`).
 * Không cho Supporter tự do đổi combobox, thay vào đó:
 * - Nút "Đảm nhận": gán supporter hiện tại và đổi status sang IN_PROGRESS.
 * - Nút "Đã giải quyết" (đơn dùng thử thì thay bằng "Chuyển giao cho System Manager").
 * - Nút "Liên hệ thất bại" cho đơn "Hỗ trợ tư vấn" (PRICING).
 * - Không có nút "Hủy".
 * - Ghi chú nội bộ lưu độc lập.
 */
export function ContactPanel({ row, handlers: _handlers, handlersError: _handlersError, onClose }: {
  row: ContactRow
  handlers: readonly ContactHandler[]
  handlersError: boolean
  onClose: () => void
}) {
  const t = useT()
  const format = useFormat()
  const { user } = useAuth()
  const { contact } = row
  const update = useUpdateContactMutation()
  const replyMutation = useReplyContactMutation()
  const forwardMutation = useForwardTrialMutation()

  const headingId = useId()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [focusRequest, setFocusRequest] = useState(0)
  useEffect(() => headingRef.current?.focus(), [focusRequest])

  const [replySubject, setReplySubject] = useState(`Phản hồi yêu cầu liên hệ #${contact.id}`)
  const [replyMessage, setReplyMessage] = useState('')
  const [note, setNote] = useState(contact.note ?? '')

  useEffect(() => {
    setReplySubject(`Phản hồi yêu cầu liên hệ #${contact.id}`)
    setNote(contact.note ?? '')
  }, [contact])

  const isDemo = contact.requestType === 'DEMO_REQUEST'
  const isPricing = contact.requestType === 'PRICING'
  const isDone = contact.status === 'RESOLVED' || contact.status === 'CLOSED'
  const isAssignedToMe = Boolean(user && contact.assignedToId === String(user.id))
  const canAssignToMe = !isDone && (!isAssignedToMe || contact.status === 'NEW')

  function handleAssignToMe() {
    update.mutate({
      contactId: contact.id,
      patch: {
        status: 'IN_PROGRESS',
        assignedToId: user ? String(user.id) : undefined,
      },
    }, {
      onSuccess: () => {
        toast.success('Đã nhận xử lý yêu cầu liên hệ!')
        setFocusRequest((request) => request + 1)
      },
      onError: (error) => toast.error(dataErrorMessage(error, t)),
    })
  }

  function handleResolve() {
    update.mutate({
      contactId: contact.id,
      patch: { status: 'RESOLVED' },
    }, {
      onSuccess: () => {
        toast.success('Đã cập nhật yêu cầu thành đã giải quyết!')
        setFocusRequest((request) => request + 1)
      },
      onError: (error) => toast.error(dataErrorMessage(error, t)),
    })
  }

  function handleFailContact() {
    update.mutate({
      contactId: contact.id,
      patch: { status: 'CLOSED' },
    }, {
      onSuccess: () => {
        toast.success('Đã cập nhật trạng thái liên hệ thất bại.')
        setFocusRequest((request) => request + 1)
      },
      onError: (error) => toast.error(dataErrorMessage(error, t)),
    })
  }

  function handleSaveNote() {
    if (noteUnchanged || Boolean(noteError)) return
    update.mutate({
      contactId: contact.id,
      patch: { note: note.trim() },
    }, {
      onSuccess: () => {
        toast.success('Đã lưu ghi chú nội bộ thành công!')
        setFocusRequest((request) => request + 1)
      },
      onError: (error) => toast.error(dataErrorMessage(error, t)),
    })
  }

  function handleSendReply() {
    if (!replyMessage.trim()) return
    replyMutation.mutate({
      contactId: contact.id,
      subject: replySubject.trim() || `Phản hồi yêu cầu liên hệ #${contact.id}`,
      message: replyMessage.trim(),
    }, {
      onSuccess: () => {
        toast.success(`Đã gửi email phản hồi thành công tới ${contact.email}`)
        setReplyMessage('')
      },
      onError: (err) => toast.error(dataErrorMessage(err, t)),
    })
  }

  function handleForwardTrial() {
    forwardMutation.mutate({
      contact,
      note: `Chuyển Quản lý duyệt tạo tài khoản dùng thử từ yêu cầu #${contact.id} (${contact.fullName})`,
    }, {
      onSuccess: () => {
        toast.success('Đã chuyển đơn yêu cầu tạo tài khoản dùng thử sang System Manager thành công!')
      },
      onError: (err) => toast.error(dataErrorMessage(err, t)),
    })
  }

  const noteUnchanged = note.trim() === (contact.note ?? '').trim()
  const noteError = note.trim().length > CONTACT_LIMITS.note ? t(NOTE_TOO_LONG, { max: CONTACT_LIMITS.note }) : undefined
  const notGiven = <span className="text-ink-3">{t('contacts.panel.notGiven')}</span>

  return (
    <Card role="region" aria-labelledby={headingId} className="flex flex-col h-full max-h-[calc(100vh-140px)] overflow-hidden">
      {/* Tiêu đề cố định trên cùng */}
      <div className="flex items-start gap-3 border-b border-line-soft px-4.5 py-3.5 flex-none bg-bg sticky top-0 z-10">
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

      {/* Vùng cuộn nội bộ */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
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
          <Detail label={t('contacts.panel.company')}>{contact.companyName ?? notGiven}</Detail>
          <Detail label="Mã công ty">
            {contact.companyCode ? <span className="font-mono text-caption font-semibold">{contact.companyCode}</span> : notGiven}
          </Detail>
          {contact.taxCode ? (
            <div className="col-span-2">
              <Detail label="Mã số thuế">
                <span className="font-mono text-caption font-semibold">{contact.taxCode}</span>
              </Detail>
            </div>
          ) : null}
        </dl>

        <div className="flex flex-col gap-1.5 border-b border-line-soft px-4.5 py-4">
          <h3 className="m-0 text-small font-semibold text-ink-2">{t('contacts.panel.message')}</h3>
          {contact.message
            ? <p className="m-0 text-body break-words whitespace-pre-wrap text-ink-1">{contact.message}</p>
            : <p className="m-0 text-body text-ink-3">{t('contacts.panel.noMessage')}</p>}
        </div>

        {isDemo && (
          <div className="border-b border-line-soft px-4.5 py-4">
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5 text-caption text-amber-800 dark:text-amber-200">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="size-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div className="flex flex-col gap-1">
                  <span className="font-semibold text-ink-strong">Yêu cầu đăng ký tài khoản dùng thử</span>
                  <span>
                    System Support không được phép duyệt trực tiếp. Hãy bấm nút "Chuyển giao cho System Manager" ở mục xử lý bên dưới để chuyển yêu cầu này sang Quản lý nền tảng.
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Phản hồi email */}
        <div className="flex flex-col gap-3 border-b border-line-soft px-4.5 py-4">
          <h3 className="m-0 flex items-center gap-1.5 text-small font-semibold text-ink-2">
            <Mail className="size-4 text-primary" />
            Phản hồi qua email cho khách
          </h3>
          <div className="flex flex-col gap-2.5">
            <Input
              label="Tiêu đề email"
              value={replySubject}
              onChange={(e) => setReplySubject(e.target.value)}
            />
            <Textarea
              label="Nội dung phản hồi email"
              rows={3}
              placeholder="Nhập nội dung phản hồi gửi qua email tới khách hàng..."
              value={replyMessage}
              onChange={(e) => setReplyMessage(e.target.value)}
            />
            <div className="flex justify-end">
              <Button
                type="button"
                variant="secondary"
                loading={replyMutation.isPending}
                disabled={!replyMessage.trim()}
                onClick={handleSendReply}
              >
                <Send className="mr-1.5 size-3.5" />
                Gửi email phản hồi
              </Button>
            </div>
          </div>
        </div>

        {/* Xử lý yêu cầu */}
        <div className="flex flex-col gap-4 px-4.5 py-4" aria-labelledby={`${headingId}-xu-ly`}>
          <h3 id={`${headingId}-xu-ly`} className="m-0 text-small font-semibold text-ink-2">{t('contacts.panel.handling')}</h3>

          {/* Trạng thái & Người nhận việc - Hiển thị thông tin read-only */}
          <div className="grid grid-cols-2 gap-3 rounded-lg border border-line-soft bg-surface-subtle p-3.5">
            <div className="flex flex-col gap-1">
              <span className="text-small text-ink-3">{t('contacts.panel.status')}</span>
              <div>
                <ContactStatusBadge status={contact.status} />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-small text-ink-3">{t('contacts.panel.assignee')}</span>
              <span className="text-body font-medium text-ink-1">
                {contact.assignedToName || t('contacts.panel.unassigned')}
              </span>
            </div>
          </div>

          {/* Nút hành động trạng thái */}
          <div className="flex flex-wrap items-center gap-2.5">
            {canAssignToMe && (
              <Button
                type="button"
                variant="primary"
                loading={update.isPending}
                onClick={handleAssignToMe}
              >
                <UserCheck className="mr-1.5 size-4" />
                Đảm nhận
              </Button>
            )}

            {isDemo ? (
              <Button
                type="button"
                variant="secondary"
                loading={forwardMutation.isPending}
                onClick={handleForwardTrial}
              >
                <Send className="mr-1.5 size-3.5" />
                Chuyển giao cho System Manager
              </Button>
            ) : (
              !isDone && (
                <Button
                  type="button"
                  variant="secondary"
                  loading={update.isPending}
                  onClick={handleResolve}
                >
                  <CheckCircle2 className="mr-1.5 size-4" />
                  Đã giải quyết
                </Button>
              )
            )}

            {isPricing && !isDone && (
              <Button
                type="button"
                variant="outline"
                loading={update.isPending}
                onClick={handleFailContact}
              >
                <PhoneOff className="mr-1.5 size-4" />
                Liên hệ thất bại
              </Button>
            )}
          </div>

          {/* Ghi chú nội bộ */}
          <div className="flex flex-col gap-2 pt-2 border-t border-line-soft">
            <Textarea
              label={t('contacts.panel.note')}
              hint={t('contacts.panel.noteHint')}
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              error={noteError}
            />
            <div className="flex justify-end">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                loading={update.isPending}
                disabled={noteUnchanged || Boolean(noteError)}
                onClick={handleSaveNote}
              >
                Lưu ghi chú
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}
