import { RotateCcw } from 'lucide-react'
import { useId, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { DataTable } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { FilterBar, type FilterField } from '@/components/FilterBar'
import { PageHero } from '@/components/PageHero'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { FieldLabel } from '@/components/ui/field-styles'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import { Spinner } from '@/components/ui/Spinner'
import { useListUrlState } from '@/components/useListUrlState'
import { useCompanyNamesQuery } from '@/features/admin/useUsersQuery'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'
import { matchesQuery } from '@/lib/list-filter'
import { TICKET_KINDS, type SupportTicket, type TicketStatus } from '@/lib/mock-db'
import { CompanyChatCard } from './CompanyChatCard'
import { CompanyPanel } from './CompanyPanel'
import { recentCompanyChat } from './support-chat'
import { createTicketColumns, TicketCompanyNamesContext } from './support-columns'
import { TicketThread } from './TicketThread'
import { ticketCompanies, ticketLabel, withThread } from './ticket-view'
import {
  SUPPORT_SOURCE,
  useReplyMutation,
  useSetTicketStatusMutation,
  useSupportTicketsQuery,
  useTicketThreadsQuery,
  useUnlockTrialMutation,
} from './useSupportQuery'

/** Bộ lọc trên URL (D-52), tiếng Việt không dấu; `ticket` là yêu cầu đang mở (cũng là đích liên kết từ nhật ký). */
const COMPANY_FILTER = 'cong-ty'
const KIND_FILTER = 'loai'
const STATUS_FILTER = 'trang-thai'
const FILTERS = [COMPANY_FILTER, KIND_FILTER, STATUS_FILTER] as const
const SELECTED_PARAM = 'ticket'

function StatusSelect({ ticket, pending, onChange }: { ticket: SupportTicket; pending: boolean; onChange: (status: TicketStatus) => void }) {
  const t = useT()
  const id = useId()
  const isDisabled = pending || ticket.status === 'CLOSED' || Boolean(ticket.lockedByOther)
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel htmlFor={id}>{t('support.page.statusLabel')}</FieldLabel>
      <Select value={ticket.status} disabled={isDisabled} onValueChange={(value) => onChange(value as TicketStatus)}>
        <SelectTrigger id={id}><SelectValue /></SelectTrigger>
        <SelectContent>
          {SUPPORT_SOURCE.statuses.map((status) => <SelectItem key={status} value={status}>{t(`support.statuses.${status}`)}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  )
}

/**
 * Hỗ trợ khách hàng `/ho-tro` (FE-8-07, `support.handle`) — màn chính của vai trò. Bảng mọi yêu cầu hỗ trợ (hoạt động gần nhất trước), lọc
 * công ty, loại, trạng thái và tìm theo tiêu đề / mã / người gửi — tất cả trên URL; bấm một dòng mở cuộc trao đổi ở cột bên phải (`?ticket=`)
 * để trả lời và đổi trạng thái (kể cả mở lại yêu cầu đã đóng), kèm khung **chỉ đọc** về công ty đó: gói, số dư và 20 giao dịch credit gần nhất.
 * Màn không có nút chính ngoài "Gửi trả lời" của cuộc trao đổi. Nối backend (`SUPPORT_SOURCE`): trao đổi và khung công ty đọc từ máy
 * chủ (trao đổi đọc riêng cho các yêu cầu của công ty đang chọn, `threads`), khung công ty có thêm ô "Đổi gói nhanh" (`planAssign`); tên
 * công ty đi kèm yêu cầu.
 */
export function SupportPage() {
  const t = useT()
  const format = useFormat()
  const query = useSupportTicketsQuery()
  const directory = useCompanyNamesQuery(SUPPORT_SOURCE.companyDirectory)
  const reply = useReplyMutation()
  const setStatus = useSetTicketStatusMutation()
  const unlockTrial = useUnlockTrialMutation()
  const list = useListUrlState<(typeof FILTERS)[number]>({ filters: FILTERS })
  const [params, setParams] = useSearchParams()

  const tickets = useMemo(() => query.data ?? [], [query.data])
  const companies = useMemo(() => (SUPPORT_SOURCE.companyDirectory ? (directory.data ?? []) : ticketCompanies(tickets)), [directory.data, tickets])
  const companyNames = useMemo(() => new Map(companies.map((company) => [company.id, company.name])), [companies])
  const { [COMPANY_FILTER]: company, [KIND_FILTER]: kind, [STATUS_FILTER]: status } = list.filters
  const rows = useMemo(() => tickets.filter((ticket) =>
    matchesQuery([ticket.title, ticketLabel(ticket), ticket.senderName], list.query)
    && (company === '' || ticket.companyId === company)
    && (kind === '' || ticket.kind === kind)
    && (status === '' || ticket.status === status)),
  [tickets, list.query, company, kind, status])
  const columns = useMemo(() => createTicketColumns(t, format, SUPPORT_SOURCE.activityTime), [t, format])

  const selectedId = params.get(SELECTED_PARAM)
  const listed = tickets.find((ticket) => ticket.id === selectedId)
  // Backend: trao đổi đọc riêng cho các yêu cầu của công ty đang chọn — khung trao đổi và khung trao đổi gần đây của công ty
  const companyTicketIds = useMemo(
    () => (listed ? tickets.filter((ticket) => ticket.companyId === listed.companyId).map((ticket) => ticket.id) : []),
    [tickets, listed],
  )
  const threads = useTicketThreadsQuery(companyTicketIds)
  const selected = listed ? withThread(listed, threads) : undefined
  const companyChat = useMemo(
    () => (listed ? recentCompanyChat(tickets.map((ticket) => withThread(ticket, threads)), listed.companyId) : []),
    [tickets, listed, threads],
  )
  function select(ticket: SupportTicket) {
    setParams((previous) => {
      const next = new URLSearchParams(previous)
      if (ticket.id === selectedId) next.delete(SELECTED_PARAM)
      else next.set(SELECTED_PARAM, ticket.id)
      return next
    }, { replace: true })
  }

  const fields: FilterField<(typeof FILTERS)[number]>[] = [
    {
      kind: 'select', name: KIND_FILTER, label: t('support.page.filters.kind'), allLabel: t('support.page.filters.allKinds'),
      options: TICKET_KINDS.map((value) => ({ value, label: t(`support.kinds.${value}`) })),
    },
    {
      kind: 'select', name: STATUS_FILTER, label: t('support.page.filters.status'), allLabel: t('support.page.filters.allStatuses'),
      options: SUPPORT_SOURCE.statuses.map((value) => ({ value, label: t(`support.statuses.${value}`) })),
    },
    {
      kind: 'select', name: COMPANY_FILTER, label: t('support.page.filters.company'), allLabel: t('support.page.filters.allCompanies'),
      options: companies.map(({ id, name }) => ({ value: id, label: name })), secondary: true,
    },
  ]

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PageHero
        title={t('support.page.title')}
        meta={query.isSuccess ? t('support.page.count', { count: tickets.length }) : undefined}
        description={t(SUPPORT_SOURCE.replies ? 'pageHero.support' : 'pageHero.supportStatusOnly')}
      />
      <div className="min-h-0 flex-1 overflow-auto px-shell py-6">
        {query.isPending ? (
          <div role="status" aria-label={t('support.page.loading')} className="flex justify-center py-16"><Spinner /></div>
        ) : query.isError ? (
          <EmptyState
            mascot="error"
            title={dataErrorMessage(query.error, t)}
            action={<Button variant="secondary" onClick={() => void query.refetch()}><RotateCcw strokeWidth={1.5} />{t('support.mine.retry')}</Button>}
          />
        ) : tickets.length === 0 ? (
          <EmptyState mascot="empty" title={t('support.page.empty')} />
        ) : (
          <div className="grid flex-none items-start gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
            {/* relative: ô ẩn định vị tuyệt đối của Radix Select không thoát khung cuộn */}
            <section className="relative min-w-0 overflow-hidden rounded-lg border border-border bg-bg">
              <FilterBar
                layout="toolbar"
                className="min-h-14 border-b border-border px-4 py-2"
                query={list.query}
                onQueryChange={list.setQuery}
                searchLabel={t('support.page.search')}
                fields={fields}
                values={list.filters}
                onValueChange={list.setFilter}
                onClear={list.clearAll}
              />
              <TicketCompanyNamesContext value={companyNames}>
                <DataTable
                  data={rows}
                  columns={columns}
                  getRowId={(ticket) => ticket.id}
                  getRowClassName={(ticket) => (ticket.status === 'CLOSED' ? 'bg-n-100/80 text-ink-3 opacity-60' : undefined)}
                  density="spacious"
                  appearance="paper"
                  onRowClick={select}
                  isRowSelected={(ticket) => ticket.id === selected?.id}
                  pagination={{ pageIndex: list.pageIndex, pageSize: list.pageSize, onPageChange: list.setPage, onPageSizeChange: list.setPageSize }}
                  emptyMessage={t('support.page.empty')}
                  isFiltering={list.isFiltering}
                  onClearFilters={list.clearAll}
                  noMatchMessage={t('support.page.noMatch')}
                />
              </TicketCompanyNamesContext>
            </section>
            <aside className="flex min-w-0 flex-col gap-4">
              {selected ? (
                <>
                  <Card
                    role="region"
                    aria-label={selected.title}
                    className={selected.status === 'CLOSED' ? 'border-n-300 bg-n-100/70 opacity-75' : undefined}
                  >
                    <div className="flex flex-col gap-4 p-4.5">
                      <StatusSelect
                        ticket={selected}
                        pending={setStatus.isPending}
                        onChange={(next) => setStatus.mutate({ ticketId: selected.id, status: next }, {
                          onSuccess: () => toast.success(t('support.page.statusChanged', { id: ticketLabel(selected), status: t(`support.statuses.${next}`) })),
                          onError: (error) => toast.error(dataErrorMessage(error, t)),
                        })}
                      />
                      <TicketThread
                        ticket={selected}
                        viewerIsSupport
                        pending={reply.isPending || unlockTrial.isPending}
                        onReply={async (text) => {
                          await reply.mutateAsync({ ticketId: selected.id, text })
                          toast.success(t('support.thread.sent'))
                        }}
                        onUnlockTrial={async (staffNote) => {
                          try {
                            await unlockTrial.mutateAsync({ ticketId: selected.id, staffNote })
                            toast.success(t('support.page.unlock.success'))
                          } catch (err) {
                            toast.error(dataErrorMessage(err, t))
                          }
                        }}
                      />
                    </div>
                  </Card>
                  {SUPPORT_SOURCE.companyPanel ? (
                    <CompanyPanel companyId={selected.companyId} companyName={selected.companyName} ticketClosed={selected.status === 'CLOSED'} />
                  ) : null}
                  {companyChat.length > 0 ? <CompanyChatCard entries={companyChat} /> : null}
                </>
              ) : (
                <Card>
                  <CardHeader><CardTitle as="h2">{t('support.page.title')}</CardTitle></CardHeader>
                  <p className="m-0 p-4.5 text-body text-ink-2">{t(SUPPORT_SOURCE.companyPanel ? 'support.page.selectHint' : 'support.page.selectHintStatusOnly')}</p>
                </Card>
              )}
            </aside>
          </div>
        )}
      </div>
    </div>
  )
}
