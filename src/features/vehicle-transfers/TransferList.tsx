import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthSafe } from '@/features/auth/AuthProvider'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useT, dataErrorMessage } from '@/lib/i18n'
import { listTransfers, type Transfer, type TransferStatus } from './vehicle-transfer-api'
import { useTransferAction } from './useTransferAction'
const statuses: TransferStatus[] = ['REQUESTED', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED']
export function TransferList({ warehouse }: { warehouse?: string }) {
  const user = useAuthSafe()?.user
  const permitted = user?.companyId && (warehouse ? user.role === 'warehouse' : user.role === 'dispatcher')
  return permitted ? <List key={`${user.companyId}:${user.id}:${warehouse ?? ''}`} warehouse={warehouse} scope={[user.companyId!, user.id]} /> : null
}
function List({ warehouse, scope }: { warehouse?: string; scope: string[] }) {
  const t = useT()
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(0)
  const [choice, setChoice] = useState<{ row: Transfer; kind: 'departure' | 'arrival' | 'cancel' } | null>(null)
  const action = useTransferAction()
  const query = useQuery({ queryKey: ['vehicle-transfers', ...scope, warehouse, status, page], queryFn: () => listTransfers(warehouse, status, page), refetchInterval: 30000 })
  const busy = Boolean(action.attempt)
  function rowView(row: Transfer) {
    const kind = !warehouse ? row.status === 'REQUESTED' ? 'cancel' : null : row.status === 'REQUESTED' && row.source_warehouse_id === Number(warehouse) ? 'departure' : row.status === 'IN_TRANSIT' && row.destination_warehouse_id === Number(warehouse) ? 'arrival' : null
    return <li key={row.id} className="min-w-0 rounded-lg border border-line bg-surface p-4">
      <h3 className="font-semibold">#{row.id} · {row.license_plate} · {row.vehicle_name}</h3>
      <p>{row.source_name} → {row.destination_name} · {t(`transfers.${row.status}`)}</p><p className="break-words">{row.reason}</p>
      <p>{t('transfers.requested')}: #{row.requested_by} · {new Date(row.requested_at).toLocaleString()}</p>
      {row.departed_at ? <p>{t('transfers.departed')}: #{row.departed_by} · {new Date(row.departed_at).toLocaleString()}</p> : null}
      {row.arrived_at ? <p>{t('transfers.arrived')}: #{row.arrived_by} · {new Date(row.arrived_at).toLocaleString()}</p> : null}
      {row.cancelled_at ? <p>{t('transfers.cancelled')}: #{row.cancelled_by} · {new Date(row.cancelled_at).toLocaleString()}</p> : null}
      {kind ? <Button size="touch" variant="secondary" className="h-auto min-h-14 max-w-full whitespace-normal" disabled={busy || query.isFetching || query.isError} onClick={() => setChoice({ row, kind })}>{t(`transfers.${kind}`)}</Button> : null}
    </li>
  }
  const rows = query.data?.data ?? []
  return <section className="mx-auto my-6 w-full max-w-(--shell-max) space-y-4" aria-label={t('transfers.title')}>
    <h2 className="text-h2 font-semibold">{t('transfers.title')}</h2>
    <label className="flex flex-col gap-2">{t('transfers.filter')}<select className="min-h-14 rounded border border-line bg-surface px-3" value={status} disabled={busy} onChange={e => { setStatus(e.target.value); setPage(0) }}><option value="">{t('transfers.all')}</option>{statuses.map(s => <option key={s} value={s}>{t(`transfers.${s}`)}</option>)}</select></label>
    <Button size="touch" variant="secondary" disabled={query.isFetching} onClick={() => void query.refetch()}>{t('transfers.refresh')}</Button>
    {query.isPending ? <p role="status">{t('transfers.loading')}</p> : null}
    {query.isError ? <p role="alert">{dataErrorMessage(query.error, t)}</p> : null}
    {query.isSuccess && rows.length === 0 ? <p role="status">{t('transfers.empty')}</p> : null}
    {warehouse ? <><h3>{t('transfers.outgoing')}</h3><ul className="space-y-3">{rows.filter(r => r.status === 'REQUESTED' && r.source_warehouse_id === Number(warehouse)).map(rowView)}</ul><h3>{t('transfers.incoming')}</h3><ul className="space-y-3">{rows.filter(r => ['REQUESTED', 'IN_TRANSIT'].includes(r.status) && r.destination_warehouse_id === Number(warehouse)).map(rowView)}</ul><h3>{t('transfers.history')}</h3><ul className="space-y-3">{rows.filter(r => ['COMPLETED', 'CANCELLED'].includes(r.status) || (r.status === 'IN_TRANSIT' && r.source_warehouse_id === Number(warehouse))).map(rowView)}</ul></> : <ul className="space-y-3">{rows.map(rowView)}</ul>}
    <nav className="flex flex-wrap gap-3"><Button size="touch" variant="secondary" disabled={busy || page === 0 || query.isFetching} onClick={() => setPage(page - 1)}>{t('transfers.previous')}</Button><span>{page + 1} / {query.data?.totalPages || 1}</span><Button size="touch" variant="secondary" disabled={busy || !query.data || query.data.last || query.isFetching} onClick={() => setPage(page + 1)}>{t('transfers.next')}</Button></nav>
    {action.error ? <p role="alert">{dataErrorMessage(action.error, t)} {t('transfers.uncertain')}<Button size="touch" variant="secondary" disabled={action.pending} onClick={action.retry}>{t('transfers.retry')}</Button></p> : null}
    {action.success ? <p role="status">{t('transfers.recorded')}</p> : null}
    <ConfirmDialog open={choice !== null} onOpenChange={open => { if (!open) setChoice(null) }} title={choice ? t(`transfers.${choice.kind}`) : ''} description={choice ? `${choice.row.license_plate} · ${choice.row.source_name} → ${choice.row.destination_name}. ${t(choice.kind === 'cancel' ? 'transfers.cancelHint' : 'transfers.physical')}` : ''} cancelLabel={t('transfers.back')} confirmLabel={t('transfers.confirm')} onConfirm={() => { if (choice) action.submit({ kind: choice.kind, id: choice.row.id, warehouse, key: crypto.randomUUID() }); setChoice(null) }} />
  </section>
}
