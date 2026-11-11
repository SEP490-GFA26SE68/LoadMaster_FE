import { Clock, FileSignature, LogOut, ShieldAlert, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Logo } from '@/components/brand/Logo'
import { LanguageMenu } from '@/components/LanguageMenu'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Textarea } from '@/components/ui/Textarea'
import { useAuthSafe } from '@/features/auth/AuthProvider'
import { SignAgreementDialog } from '@/features/billing/SignAgreementDialog'
import { useMyAgreementQuery, useSignAgreementMutation } from '@/features/billing/useAgreementQuery'
import { dataErrorMessage, useT } from '@/lib/i18n'
import type { SupportTicket } from '@/lib/mock-db'
import { TicketKindBadge, TicketStatusBadge } from './TicketBadges'
import { useCreateTicketMutation, useSupportTicketsQuery } from './useSupportQuery'

/**
 * Màn thay khung ứng dụng khi tài khoản dùng thử bị gắn cờ vì quá 72 giờ chưa ký thoả thuận (chỉ khi nối backend — kho mẫu không có
 * tài khoản bị gắn cờ): gửi yêu cầu hỗ trợ mở khoá, theo dõi yêu cầu đang chờ, hoặc ký thoả thuận ngay khi còn ký được.
 */
export function TrialAccountLockedView() {
  const t = useT()
  const auth = useAuthSafe()
  const user = auth?.user

  const ticketsQuery = useSupportTicketsQuery()
  const createTicketMutation = useCreateTicketMutation()
  const myAgreementQuery = useMyAgreementQuery()
  const signAgreementMutation = useSignAgreementMutation()

  const [reason, setReason] = useState('')
  const [openSignDialog, setOpenSignDialog] = useState(false)

  const pendingTicket: SupportTicket | undefined = (ticketsQuery.data ?? []).find(
    (ticket) =>
      ticket.kind === 'TRIAL_ACCOUNT_UNLOCK' &&
      (ticket.status === 'OPEN' || ticket.status === 'IN_PROGRESS'),
  )

  const agreement = myAgreementQuery.data ?? null

  async function handleSendUnlockRequest(e: React.FormEvent) {
    e.preventDefault()
    if (!reason.trim()) {
      toast.error(t('support.trialLocked.reasonRequired'))
      return
    }

    try {
      await createTicketMutation.mutateAsync({
        kind: 'TRIAL_ACCOUNT_UNLOCK',
        title: t('support.trialLocked.ticketTitle', { name: user?.fullName ?? user?.email ?? '' }),
        description: reason.trim(),
      })
      toast.success(t('support.trialLocked.sent'))
      setReason('')
    } catch (err) {
      toast.error(dataErrorMessage(err, t))
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-app text-ink-1">
      <header className="flex h-16 items-center justify-between border-b border-border bg-bg px-6">
        <div className="flex items-center gap-3">
          <Logo size="sm" />
          <Badge tone="danger">{t('support.trialLocked.badge')}</Badge>
        </div>
        <div className="flex items-center gap-3">
          <LanguageMenu />
          {user?.email ? (
            <span className="hidden text-caption text-ink-3 sm:inline">{user.email}</span>
          ) : null}
          <Button type="button" variant="ghost" size="sm" onClick={() => void auth?.signOut?.()}>
            <LogOut strokeWidth={1.5} />
            {t('support.trialLocked.signOut')}
          </Button>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center p-4 sm:p-6 md:p-8">
        <Card className="w-full max-w-2xl">
          <div className="flex flex-col gap-6 p-6 sm:p-8">
            <div className="flex items-start gap-4">
              <div className="flex size-12 flex-none items-center justify-center rounded-lg bg-red-50 text-danger">
                <ShieldAlert className="size-6" strokeWidth={1.5} />
              </div>
              <div className="flex-1">
                <h1 className="m-0 font-display text-h2 font-bold text-ink-strong">{t('support.trialLocked.title')}</h1>
                <p className="mt-2 text-body text-ink-2">{t('support.trialLocked.body')}</p>
              </div>
            </div>

            {pendingTicket ? (
              <div className="flex flex-col gap-3 rounded-lg border border-azure-200 bg-azure-50 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Clock className="size-4 text-azure-700" strokeWidth={1.5} />
                    <span className="font-semibold text-ink-strong">{t('support.trialLocked.pendingTitle')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <TicketStatusBadge status={pendingTicket.status} />
                    <TicketKindBadge kind={pendingTicket.kind} />
                  </div>
                </div>
                <div className="rounded-md bg-bg p-3 text-caption">
                  <div className="font-mono font-semibold text-ink-1">{pendingTicket.code ?? pendingTicket.id}</div>
                  <p className="mt-1 mb-0 whitespace-pre-wrap text-ink-2">{pendingTicket.description}</p>
                </div>
                <p className="m-0 text-caption text-ink-2">{t('support.trialLocked.pendingNote')}</p>
              </div>
            ) : (
              <form onSubmit={handleSendUnlockRequest} className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
                <div className="flex items-center gap-2 font-semibold text-ink-strong">
                  <Sparkles className="size-4 text-amber-700" strokeWidth={1.5} />
                  <span>{t('support.trialLocked.formTitle')}</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="unlock-reason" className="text-small font-semibold text-ink-2">
                    {t('support.trialLocked.reasonLabel')} <span aria-hidden="true">*</span>
                  </label>
                  <Textarea
                    id="unlock-reason"
                    rows={4}
                    required
                    aria-required
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder={t('support.trialLocked.reasonPlaceholder')}
                  />
                </div>
                <div className="flex justify-end">
                  <Button type="submit" variant="primary" loading={createTicketMutation.isPending}>
                    {t('support.trialLocked.submit')}
                  </Button>
                </div>
              </form>
            )}

            {agreement && agreement.status !== 'SIGNED' ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-bg p-4">
                <div className="flex items-center gap-3">
                  <FileSignature className="size-5 text-primary" strokeWidth={1.5} />
                  <div>
                    <div className="text-small font-medium text-ink-strong">{t('support.trialLocked.signTitle')}</div>
                    <div className="text-caption text-ink-3">{t('support.trialLocked.signHint')}</div>
                  </div>
                </div>
                <Button type="button" variant="secondary" size="sm" onClick={() => setOpenSignDialog(true)}>
                  {t('support.trialLocked.signNow')}
                </Button>
              </div>
            ) : null}
          </div>
        </Card>
      </main>

      {openSignDialog && agreement ? (
        <SignAgreementDialog
          agreement={agreement}
          open={openSignDialog}
          onClose={() => setOpenSignDialog(false)}
          isSigning={signAgreementMutation.isPending}
          onSign={async (request) => {
            try {
              await signAgreementMutation.mutateAsync(request)
              toast.success(t('support.trialLocked.signed'))
              setOpenSignDialog(false)
              auth?.refreshUser?.()
            } catch (err) {
              toast.error(dataErrorMessage(err, t))
            }
          }}
        />
      ) : null}
    </div>
  )
}
