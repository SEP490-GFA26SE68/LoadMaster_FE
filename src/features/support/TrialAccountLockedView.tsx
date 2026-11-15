import { ChevronDown, ChevronUp, Clock, FileSignature, HelpCircle, LogOut, ShieldAlert, Sparkles } from 'lucide-react'
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
import { TicketStatusBadge } from './TicketBadges'
import { useCreateTicketMutation, useSupportTicketsQuery } from './useSupportQuery'

/**
 * Màn hình thay thế toàn bộ ứng dụng khi tài khoản bị gắn cờ FLAGGED (quá hạn 72h chưa ký thỏa thuận).
 * Áp dụng PHƯƠNG ÁN A (Self-Service): Cho phép người dùng ký thỏa thuận điện tử trực tiếp
 * để tự động mở khóa phục hồi tài khoản về ACTIVE ngay tức thì, không bắt buộc qua bước duyệt ticket.
 */
export function TrialAccountLockedView() {
  const t = useT()
  const auth = useAuthSafe()
  const user = auth?.user

  const ticketsQuery = useSupportTicketsQuery()
  const createTicketMutation = useCreateTicketMutation()
  const myAgreementQuery = useMyAgreementQuery()
  const signAgreementMutation = useSignAgreementMutation()

  const [openSignDialog, setOpenSignDialog] = useState(false)
  const [showHelpSection, setShowHelpSection] = useState(false)
  const [supportMessage, setSupportMessage] = useState('')

  const agreement = myAgreementQuery.data ?? null

  const pendingTicket: SupportTicket | undefined = (ticketsQuery.data ?? []).find(
    (ticket) =>
      ticket.status === 'OPEN' || ticket.status === 'IN_PROGRESS',
  )

  async function handleSendSupportRequest(e: React.FormEvent) {
    e.preventDefault()
    if (!supportMessage.trim()) {
      toast.error(t('support.trialLocked.reasonRequired'))
      return
    }

    try {
      await createTicketMutation.mutateAsync({
        kind: 'TRIAL_ACCOUNT_UNLOCK',
        title: t('support.trialLocked.ticketTitle', { name: user?.fullName ?? user?.email ?? '' }),
        description: supportMessage.trim(),
      })
      toast.success(t('support.trialLocked.sent'))
      setSupportMessage('')
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
                <h1 className="m-0 font-display text-h2 font-bold text-ink-strong">
                  {t('support.trialLocked.title')}
                </h1>
                <p className="mt-2 text-body text-ink-2">
                  {t('support.trialLocked.body')}
                </p>
              </div>
            </div>

            {/* HERO SECTION: TỰ PHỤC VỤ KÝ THỎA THUẬN ĐỂ MỞ KHÓA NGAY */}
            <div className="flex flex-col gap-4 rounded-lg border border-cyan-200 bg-surface p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-tint-blue text-tint-blue-fg">
                    <FileSignature className="h-5 w-5" strokeWidth={1.5} aria-hidden />
                  </div>
                  <div>
                    <h2 className="text-body font-semibold text-ink-strong">{t('support.trialLocked.signTitle')}</h2>
                    <p className="text-caption text-ink-3">{t('support.trialLocked.signAuto')}</p>
                  </div>
                </div>
                <Badge tone="success">{t('support.trialLocked.signAutoTag')}</Badge>
              </div>

              {agreement ? (
                <div className="rounded-lg border border-border bg-surface p-3.5 text-small">
                  <div className="font-semibold text-ink-strong">{agreement.title}</div>
                  <div className="mt-2 grid grid-cols-1 gap-1 text-caption text-ink-2 sm:grid-cols-2">
                    <div>
                      <span className="text-ink-3">{t('support.trialLocked.agreementCompany')}</span> {agreement.companyName}
                    </div>
                    <div>
                      <span className="text-ink-3">{t('support.trialLocked.agreementCode')}</span> {agreement.agreementCode}
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="flex justify-end pt-1">
                <Button
                  type="button"
                  variant="primary"
                  className="w-full sm:w-auto"
                  onClick={() => setOpenSignDialog(true)}
                >
                  <FileSignature strokeWidth={1.5} aria-hidden />
                  {t('support.trialLocked.signUnlock')}
                </Button>
              </div>
            </div>

            {/* SECONDARY / OPTIONAL: HỖ TRỢ KỸ THUẬT NẾU GẶP SỰ CỐ */}
            <div className="border-t border-border pt-2">
              <button
                type="button"
                onClick={() => setShowHelpSection((prev) => !prev)}
                className="flex w-full items-center justify-between py-2 text-left text-small font-medium text-ink-2 hover:text-ink-1"
              >
                <div className="flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-ink-3" />
                  <span>{t('support.trialLocked.helpToggle')}</span>
                </div>
                {showHelpSection ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>

              {showHelpSection ? (
                <div className="mt-3 flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
                  {pendingTicket ? (
                    <div className="flex flex-col gap-2 rounded-lg border border-azure-200 bg-azure-50 p-3 text-caption">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-azure-700" strokeWidth={1.5} aria-hidden />
                          <span className="font-semibold text-azure-700">
                            {t('support.trialLocked.pendingTitle')}
                          </span>
                        </div>
                        <TicketStatusBadge status={pendingTicket.status} />
                      </div>
                      <div className="font-mono text-ink-2">{pendingTicket.code ?? pendingTicket.id}</div>
                      <p className="m-0 text-ink-3 whitespace-pre-wrap">{pendingTicket.description}</p>
                    </div>
                  ) : (
                    <form onSubmit={handleSendSupportRequest} className="flex flex-col gap-3">
                      <div className="flex items-center gap-2 text-caption font-semibold text-ink-strong">
                        <Sparkles className="h-4 w-4 text-warning" strokeWidth={1.5} aria-hidden />
                        <span>{t('support.trialLocked.formTitle')}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label htmlFor="support-message" className="text-caption font-medium text-ink-2">
                          {t('support.trialLocked.helpLabel')}
                          <span aria-hidden> *</span>
                        </label>
                        <Textarea
                          id="support-message"
                          rows={3}
                          required
                          value={supportMessage}
                          onChange={(e) => setSupportMessage(e.target.value)}
                          placeholder={t('support.trialLocked.helpPlaceholder')}
                        />
                      </div>
                      <div className="flex justify-end">
                        <Button
                          type="submit"
                          variant="secondary"
                          size="sm"
                          loading={createTicketMutation.isPending}
                        >
                          {t('support.trialLocked.helpSubmit')}
                        </Button>
                      </div>
                    </form>
                  )}
                </div>
              ) : null}
            </div>
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
              await auth?.refreshUser()
            } catch (err) {
              toast.error(dataErrorMessage(err, t))
            }
          }}
        />
      ) : null}
    </div>
  )
}
