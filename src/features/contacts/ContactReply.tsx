import { Mail, Send } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { dataErrorMessage, useT } from '@/lib/i18n'
import type { GuestContact } from '@/lib/mock-db'
import { useReplyContactMutation } from './useContactsQuery'

/** Gửi email trả lời khách từ khung xử lý (`ContactPanel`) — chỉ khi nguồn gửi được email (`CONTACTS_SOURCE.canReply`). */
export function ContactReply({ contact }: { contact: GuestContact }) {
  const t = useT()
  const reply = useReplyContactMutation()
  const defaultSubject = t('contacts.panel.reply.defaultSubject', { id: contact.id })
  const [subject, setSubject] = useState(defaultSubject)
  const [message, setMessage] = useState('')

  function handleSend() {
    if (!message.trim()) return
    reply.mutate(
      { contactId: contact.id, subject: subject.trim() || defaultSubject, message: message.trim() },
      {
        onSuccess: () => {
          toast.success(t('contacts.panel.reply.sent', { email: contact.email }))
          setMessage('')
        },
        onError: (error) => toast.error(dataErrorMessage(error, t)),
      },
    )
  }

  return (
    <div className="flex flex-col gap-3 border-b border-line-soft px-4.5 py-4">
      <h3 className="m-0 flex items-center gap-1.5 text-small font-semibold text-ink-2">
        <Mail aria-hidden className="size-4 text-primary" strokeWidth={1.5} />
        {t('contacts.panel.reply.title')}
      </h3>
      <div className="flex flex-col gap-2.5">
        <Input label={t('contacts.panel.reply.subject')} value={subject} onChange={(event) => setSubject(event.target.value)} />
        <Textarea
          label={t('contacts.panel.reply.message')}
          rows={3}
          placeholder={t('contacts.panel.reply.placeholder')}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
        <div className="flex justify-end">
          <Button type="button" variant="secondary" loading={reply.isPending} disabled={!message.trim()} onClick={handleSend}>
            {reply.isPending ? null : <Send aria-hidden className="size-3.5" strokeWidth={1.5} />}
            {t('contacts.panel.reply.send')}
          </Button>
        </div>
      </div>
    </div>
  )
}
