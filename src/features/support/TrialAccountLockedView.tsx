import { Clock, FileSignature, LogOut, ShieldAlert, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { LanguageMenu } from '@/components/LanguageMenu'
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
      toast.error('Vui lòng nhập lý do đề nghị mở lại tài khoản')
      return
    }

    try {
      await createTicketMutation.mutateAsync({
        kind: 'TRIAL_ACCOUNT_UNLOCK',
        title: `Yêu cầu mở khóa tài khoản dùng thử - ${user?.fullName ?? user?.email ?? ''}`,
        description: reason.trim(),
      })
      toast.success('Đã gửi yêu cầu mở khóa tài khoản thành công!')
      setReason('')
    } catch (err) {
      toast.error(dataErrorMessage(err, t))
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-ink-1">
      {/* Top bar */}
      <header className="flex h-16 items-center justify-between border-b border-border bg-surface px-6 shadow-xs">
        <div className="flex items-center gap-3">
          <span className="font-display text-h3 font-bold tracking-tight text-primary">LoadMaster</span>
          <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-caption font-semibold text-red-700 dark:bg-red-950/60 dark:text-red-300">
            Tài khoản bị khóa
          </span>
        </div>
        <div className="flex items-center gap-3">
          <LanguageMenu />
          {user?.email ? (
            <span className="hidden text-caption text-ink-3 sm:inline">{user.email}</span>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => auth?.signOut?.()}
            className="text-ink-2 hover:text-ink-1"
          >
            <LogOut className="mr-1.5 h-4 w-4" />
            Đăng xuất
          </Button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex flex-1 items-center justify-center p-4 sm:p-6 md:p-8">
        <Card className="w-full max-w-2xl border-red-200 shadow-md dark:border-red-900/50">
          <div className="flex flex-col gap-6 p-6 sm:p-8">
            {/* Header Alert */}
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h1 className="m-0 font-display text-h2 font-bold text-ink-strong">
                  Tài khoản tạm thời bị khóa do chưa hoàn tất ký thỏa thuận dịch vụ trong 72 giờ
                </h1>
                <p className="mt-2 text-body text-ink-2">
                  Theo quy định của LoadMaster, các đơn vị dùng thử cần hoàn tất ký xác nhận thỏa thuận điện tử trong vòng 72 giờ kể từ khi kích hoạt tài khoản. Toàn bộ các API và trang nghiệp vụ đã tạm dừng.
                </p>
              </div>
            </div>

            {/* Action Section */}
            {pendingTicket ? (
              <div className="flex flex-col gap-3 rounded-xl border border-azure-200 bg-azure-50/70 p-5 dark:border-azure-800 dark:bg-azure-950/30">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-azure-600 dark:text-azure-400" />
                    <span className="font-semibold text-azure-900 dark:text-azure-200">
                      Yêu cầu mở khóa của bạn đang được tiếp nhận
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <TicketStatusBadge status={pendingTicket.status} />
                    <TicketKindBadge kind={pendingTicket.kind} />
                  </div>
                </div>
                <div className="rounded-lg bg-surface p-3 text-caption">
                  <div className="font-mono font-bold text-ink-1">{pendingTicket.code ?? pendingTicket.id}</div>
                  <p className="mt-1 mb-0 text-ink-2 whitespace-pre-wrap">{pendingTicket.description}</p>
                </div>
                <p className="m-0 text-caption text-azure-800 dark:text-azure-300">
                  Nhân viên hỗ trợ sẽ kiểm tra đơn và mở lại tài khoản của bạn trong thời gian sớm nhất.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSendUnlockRequest} className="flex flex-col gap-4 rounded-xl border border-border bg-surface-subtle p-5">
                <div className="flex items-center gap-2 font-semibold text-ink-strong">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  <span>Gửi yêu cầu hỗ trợ mở khóa tài khoản</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="unlock-reason" className="text-caption font-medium text-ink-1">
                    Lý do đề nghị mở lại tài khoản *
                  </label>
                  <Textarea
                    id="unlock-reason"
                    rows={4}
                    required
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Ví dụ: Chúng tôi bận công tác nên chưa kịp ký thỏa thuận trong 72 giờ, kính đề nghị đội ngũ hỗ trợ mở khóa để chúng tôi ký lại..."
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    variant="primary"
                    loading={createTicketMutation.isPending}
                  >
                    Gửi yêu cầu mở khóa
                  </Button>
                </div>
              </form>
            )}

            {/* Direct sign agreement option if agreement exists */}
            {agreement && agreement.status !== 'SIGNED' ? (
              <div className="flex items-center justify-between rounded-lg border border-border bg-surface p-4">
                <div className="flex items-center gap-3">
                  <FileSignature className="h-5 w-5 text-primary" />
                  <div>
                    <div className="text-small font-medium text-ink-strong">Ký thỏa thuận trực tuyến</div>
                    <div className="text-caption text-ink-3">Bạn có thể hoàn tất ký trực tiếp ngay bây giờ để mở khóa ngay</div>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setOpenSignDialog(true)}
                >
                  Ký thỏa thuận ngay
                </Button>
              </div>
            ) : null}
          </div>
        </Card>
      </main>

      {/* Dialog ký thỏa thuận */}
      {openSignDialog && agreement ? (
        <SignAgreementDialog
          agreement={agreement}
          open={openSignDialog}
          onClose={() => setOpenSignDialog(false)}
          isSigning={signAgreementMutation.isPending}
          onSign={async (request) => {
            try {
              await signAgreementMutation.mutateAsync(request)
              toast.success('Ký thỏa thuận thành công! Tài khoản của bạn đã được kích hoạt.')
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
