import { useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { useAuthSafe } from '@/features/auth/AuthProvider'
import { dataErrorMessage, useT } from '@/lib/i18n'
import { usesBackend } from '@/lib/backend-config'
import type { CompanyWarehouse } from './company-warehouses-api'
import { useWarehouseStaffAssignments } from './useWarehouseStaffAssignments'

export function WarehouseStaffAssignments({ warehouse }: { warehouse: CompanyWarehouse }) {
  const user = useAuthSafe()?.user
  if (user?.role !== 'companyManager' || !user.companyId) return null
  return <StaffPanel key={`${user.companyId}:${user.id}:${warehouse.id}`} scope={`${user.companyId}:${user.id}`} warehouse={warehouse} />
}
function StaffPanel({ scope, warehouse }: { scope: string; warehouse: CompanyWarehouse }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState('')
  const [revoking, setRevoking] = useState<number | null>(null)
  const [notice, setNotice] = useState('')
  const latch = useRef(false)
  const { staff, assignments, history, mutation, refresh } = useWarehouseStaffAssignments(scope, warehouse.id, open)
  const rows = assignments.data ?? []
  const loading = staff.isPending || assignments.isPending || history.isPending
  const error = staff.error ?? assignments.error ?? history.error
  const disabled = loading || Boolean(error) || mutation.isPending
  const available = (staff.data ?? []).filter(person => person.status === 'ACTIVE' && !rows.some(row => row.userId === person.userId && row.active))
  async function change(userId: number, active: boolean) {
    if (latch.current) return
    latch.current = true
    setNotice('')
    try {
      await mutation.mutateAsync({ userId, active })
      setSelected(''); setRevoking(null); setNotice(t('companyWarehouses.staffSaved'))
    } catch { /* Mutation error stays visible; onSettled re-reads server state. */ }
    finally { latch.current = false }
  }
  const stateLabel = (active: boolean | null) => t(active === null ? 'companyWarehouses.staffNotAssigned' : active ? 'companyWarehouses.staffAssigned' : 'companyWarehouses.staffRevoked')
  return <details className="mt-4 border-t border-border pt-4" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary className="min-h-14 cursor-pointer py-4 font-medium">{t('companyWarehouses.staffTitle')}</summary>
    {open && (!usesBackend('companies') ? <p>{t('companyWarehouses.staffBackendOnly')}</p> : <div className="space-y-4">
      <p className="text-text-2">{t('companyWarehouses.staffHint')}</p>
      {loading && <p role="status">{t('companyWarehouses.staffLoading')}</p>}
      {error && <div role="alert"><p>{dataErrorMessage(error, t)}</p><Button variant="secondary" onClick={() => void refresh()}>{t('companyWarehouses.retry')}</Button></div>}
      <label className="block">{t('companyWarehouses.staffChoose')}
        <select className="mt-2 min-h-14 w-full rounded border border-border bg-bg px-3 text-base" value={selected} disabled={disabled || !warehouse.isActive} onChange={event => setSelected(event.target.value)}>
          <option value="">{t('companyWarehouses.staffChoose')}</option>
          {available.map(person => <option key={person.userId} value={person.userId}>{person.fullName} (#{person.userId})</option>)}
        </select>
      </label>
      <Button className="min-h-14" disabled={disabled || !warehouse.isActive || !available.some(person => String(person.userId) === selected)} onClick={() => void change(Number(selected), true)}>{t('companyWarehouses.staffAssign')}</Button>
      {!warehouse.isActive && <p>{t('companyWarehouses.staffInactiveWarehouse')}</p>}
      {!loading && !error && rows.length === 0 && <p>{t('companyWarehouses.staffEmpty')}</p>}
      <ul className="space-y-3">{rows.map(row => <li key={row.userId} className="rounded border border-border p-3">
        <p className="break-words">{row.fullName} (#{row.userId}) · {stateLabel(row.active)}{row.status !== 'ACTIVE' && ` · ${t('companyWarehouses.staffInactive')}`}</p>
        {row.active && (revoking === row.userId ? <div className="mt-2 flex flex-wrap gap-2">
          <p className="w-full">{t('companyWarehouses.staffConfirmRevoke')}</p>
          <Button className="min-h-14" disabled={disabled} onClick={() => void change(row.userId, false)}>{t('companyWarehouses.staffRevokeConfirm')}</Button>
          <Button className="min-h-14" variant="secondary" disabled={mutation.isPending} onClick={() => setRevoking(null)}>{t('companyWarehouses.cancel')}</Button>
        </div> : <Button className="mt-2 min-h-14" variant="secondary" disabled={disabled} onClick={() => setRevoking(row.userId)}>{t('companyWarehouses.staffRevoke')}</Button>)}
      </li>)}</ul>
      {mutation.error && <p role="alert">{dataErrorMessage(mutation.error, t)} {t('companyWarehouses.staffRefreshHint')}</p>}
      {notice && <p role="status">{notice}</p>}
      <Button className="min-h-14" variant="secondary" disabled={mutation.isPending} onClick={() => void refresh()}>{t('companyWarehouses.staffRefresh')}</Button>
      <h3 className="font-semibold">{t('companyWarehouses.staffHistory')}</h3>
      <ol className="space-y-2">{history.data?.pages.flat().map(event => <li key={event.id} className="break-words rounded border border-border p-3">
        #{event.userId}: {stateLabel(event.oldActive)} → {stateLabel(event.newActive)} · {event.actorName ?? `#${event.actorId}`} · <time dateTime={event.recordedAt}>{event.recordedAt}</time>
      </li>)}</ol>
      {!history.isPending && !history.error && history.data?.pages[0]?.length === 0 && <p>{t('companyWarehouses.staffNoHistory')}</p>}
      {history.hasNextPage && <Button className="min-h-14" variant="secondary" disabled={history.isFetchingNextPage} onClick={() => void history.fetchNextPage()}>{t('companyWarehouses.staffMoreHistory')}</Button>}
    </div>)}
  </details>
}
