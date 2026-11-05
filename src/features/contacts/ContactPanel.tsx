import { CheckCircle2, PhoneOff, Send, UserCheck, X } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Banner } from '@/components/Banner'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Textarea } from '@/components/ui/Textarea'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'
import { CONTACT_LIMITS } from '@/lib/mock-db'
import { ContactStatusBadge, ContactTypeBadge } from './ContactBadges'
import { ContactPlan } from './ContactPlan'
import { ContactReply } from './ContactReply'
import type { ContactRow } from './contact-list'
import { mailtoHref, NOTE_TOO_LONG } from './contact-panel-form'
import {
  CONTACTS_SOURCE,
  useClaimContactMutation,
  useForwardTrialMutation,
  useUpdateContactMutation,
} from './useContactsQuery'

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-small text-ink-3">{label}</dt>
      <dd className="m-0 min-w-0 break-words text-body text-ink-1">{children}</dd>
    </div>
  )
}

/**
 * Khung bên phải của `/lien-he-khach` (`?lien-he=<mã>`): thông tin khách gửi, nội dung, và phần xử lý. Cuộn trong khung
 * (`overscroll-contain`). Người xử lý không tự đổi trạng thái hay người nhận việc bằng ô chọn:
 * - "Đảm nhận": nhận việc cho chính mình, trạng thái Đang xử lý.
 * - Đã nhận: "Đã giải quyết" — đơn dùng thử thì thay bằng chuyển cho quản lý nền tảng (khi nguồn có yêu cầu dùng thử,
 *   `CONTACTS_SOURCE.canForwardTrial`); đơn tư vấn có thêm "Liên hệ thất bại" (Đã đóng).
 * - Ghi chú nội bộ lưu riêng; gửi email trả lời khách chỉ có khi nguồn gửi được (`CONTACTS_SOURCE.canReply`).
 */
export function ContactPanel({ row, onClose }: { row: ContactRow; onClose: () => void }) {
  const t = useT()
  const format = useFormat()
  const { contact } = row
  const update = useUpdateContactMutation()
  const claim = useClaimContactMutation()
  const forwardMutation = useForwardTrialMutation()

  const headingId = useId()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [focusRequest, setFocusRequest] = useState(0)
  useEffect(() => headingRef.current?.focus(), [focusRequest])

  const [note, setNote] = useState(contact.note ?? '')

  // Bản mới của yêu cầu (người khác vừa lưu, hay chính mình vừa ghi) thay ghi chú đang hiện
  useEffect(() => setNote(contact.note ?? ''), [contact])

  const forwardsTrial = contact.requestType === 'DEMO_REQUEST' && CONTACTS_SOURCE.canForwardTrial
  const isPricing = contact.requestType === 'PRICING'
  const isDone = contact.status === 'RESOLVED' || contact.status === 'CLOSED'
  const isClaimed = contact.status === 'IN_PROGRESS'
  const canClaim = !isDone && !isClaimed

  function done(message: string) {
    return {
      onSuccess: () => {
        toast.success(message)
        setFocusRequest((request) => request + 1)
      },
      onError: (error: unknown) => toast.error(dataErrorMessage(error, t)),
    }
  }

  function handleClaim() {
    claim.mutate(contact.id, done(t('contacts.panel.claimed')))
  }

  function handleResolve() {
    update.mutate({ contactId: contact.id, patch: { status: 'RESOLVED' } }, done(t('contacts.panel.resolvedToast')))
  }

  function handleFailContact() {
    update.mutate({ contactId: contact.id, patch: { status: 'CLOSED' } }, done(t('contacts.panel.failedToast')))
  }

  function handleSaveNote() {
    if (noteUnchanged || Boolean(noteError)) return
    update.mutate({ contactId: contact.id, patch: { note: note.trim() } }, done(t('contacts.panel.noteSaved')))
  }

  function handleForwardTrial() {
    forwardMutation.mutate(
      { contact, note: t('contacts.panel.trial.forwardNote', { id: contact.id, name: contact.fullName }) },
      {
        onSuccess: () => toast.success(t('contacts.panel.trial.forwarded')),
        onError: (error) => toast.error(dataErrorMessage(error, t)),
      },
    )
  }

  const noteUnchanged = note.trim() === (contact.note ?? '').trim()
  const noteError = note.trim().length > CONTACT_LIMITS.note ? t(NOTE_TOO_LONG, { max: CONTACT_LIMITS.note }) : undefined
  const notGiven = <span className="text-ink-3">{t('contacts.panel.notGiven')}</span>
  const busy = update.isPending || claim.isPending

  return (
    <Card role="region" aria-labelledby={headingId} className="flex h-full max-h-[calc(100vh-140px)] flex-col overflow-hidden">
      <div className="sticky top-0 z-10 flex flex-none items-start gap-3 border-b border-line-soft bg-bg px-4.5 py-3.5">
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

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
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
          <Detail label={t('contacts.panel.companyCode')}>
            {contact.companyCode ? <span className="font-mono text-caption">{contact.companyCode}</span> : notGiven}
          </Detail>
          {contact.taxCode ? (
            <div className="col-span-2">
              <Detail label={t('contacts.panel.taxCode')}><span className="font-mono text-caption">{contact.taxCode}</span></Detail>
            </div>
          ) : null}
        </dl>

        <div className="flex flex-col gap-1.5 border-b border-line-soft px-4.5 py-4">
          <h3 className="m-0 text-small font-semibold text-ink-2">{t('contacts.panel.message')}</h3>
          {contact.message
            ? <p className="m-0 text-body break-words whitespace-pre-wrap text-ink-1">{contact.message}</p>
            : <p className="m-0 text-body text-ink-3">{t('contacts.panel.noMessage')}</p>}
        </div>

        {forwardsTrial && !isDone ? (
          <div className="border-b border-line-soft px-4.5 py-4">
            <Banner tone="warning">
              <span className="flex flex-col gap-1">
                <span className="font-semibold text-ink-strong">{t('contacts.panel.trial.title')}</span>
                <span>{isClaimed ? t('contacts.panel.trial.forwardHint') : t('contacts.panel.trial.claimFirst')}</span>
              </span>
            </Banner>
          </div>
        ) : null}

        {CONTACTS_SOURCE.canReply ? <ContactReply key={contact.id} contact={contact} /> : null}

        <div className="flex flex-col gap-4 px-4.5 py-4" aria-labelledby={`${headingId}-xu-ly`}>
          <h3 id={`${headingId}-xu-ly`} className="m-0 text-small font-semibold text-ink-2">{t('contacts.panel.handling')}</h3>

          <div className="grid grid-cols-2 gap-3 rounded-lg border border-line-soft bg-surface p-3.5">
            <div className="flex flex-col gap-1">
              <span className="text-small text-ink-3">{t('contacts.panel.status')}</span>
              <div><ContactStatusBadge status={contact.status} /></div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-small text-ink-3">{t('contacts.panel.assignee')}</span>
              <span className="text-body font-medium text-ink-1">{contact.assignedToName || t('contacts.panel.unassigned')}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {canClaim ? (
              <Button type="button" variant="primary" loading={claim.isPending} disabled={busy} onClick={handleClaim}>
                {claim.isPending ? null : <UserCheck aria-hidden className="size-4" strokeWidth={1.5} />}
                {t('contacts.panel.claim')}
              </Button>
            ) : null}
            {isClaimed ? (
              <>
                {forwardsTrial ? (
                  <Button type="button" variant="secondary" loading={forwardMutation.isPending} onClick={handleForwardTrial}>
                    {forwardMutation.isPending ? null : <Send aria-hidden className="size-3.5" strokeWidth={1.5} />}
                    {t('contacts.panel.trial.forward')}
                  </Button>
                ) : (
                  <Button type="button" variant="secondary" loading={update.isPending} disabled={busy} onClick={handleResolve}>
                    {update.isPending ? null : <CheckCircle2 aria-hidden className="size-4" strokeWidth={1.5} />}
                    {t('contacts.panel.resolve')}
                  </Button>
                )}
                {isPricing ? (
                  <Button type="button" variant="secondary" disabled={busy} onClick={handleFailContact}>
                    <PhoneOff aria-hidden className="size-4" strokeWidth={1.5} />
                    {t('contacts.panel.failContact')}
                  </Button>
                ) : null}
              </>
            ) : null}
          </div>

          <div className="flex flex-col gap-2 border-t border-line-soft pt-2">
            <Textarea
              label={t('contacts.panel.note')}
              hint={t('contacts.panel.noteHint')}
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              error={noteError}
            />
            <div className="flex justify-end">
              <Button type="button" variant="secondary" size="sm" loading={update.isPending} disabled={noteUnchanged || Boolean(noteError)} onClick={handleSaveNote}>
                {t('contacts.panel.saveNote')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}
