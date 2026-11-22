import { useState } from 'react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { useAuthSafe } from '@/features/auth/AuthProvider'
import { ForbiddenPage } from '@/app/ForbiddenPage'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { usesBackend } from '@/lib/backend-config'
import { useT, dataErrorMessage } from '@/lib/i18n'
import { transferWarehouses, transferCandidates } from './vehicle-transfer-api'
import { useTransferAction } from './useTransferAction'
import { TransferList } from './TransferList'
export function VehicleTransferPage() {
  const user = useAuthSafe()?.user
  return user?.role === 'dispatcher' && user.companyId ? <Page key={`${user.companyId}:${user.id}`} scope={[user.companyId, user.id]} /> : <ForbiddenPage />
}
function Page({ scope }: { scope: string[] }) {
  const t = useT()
  const [source, setSource] = useState('')
  const [destination, setDestination] = useState('')
  const [vehicle, setVehicle] = useState('')
  const [reason, setReason] = useState('')
  const [page, setPage] = useState(0)
  const [confirm, setConfirm] = useState(false)
  const backend = usesBackend('fleet')
  const warehouses = useQuery({ queryKey: ['vehicle-transfers', ...scope, 'warehouses'], queryFn: transferWarehouses, enabled: backend })
  const vehicles = useQuery({ queryKey: ['vehicle-transfers', ...scope, 'candidates', source, page], queryFn: () => transferCandidates(source, page), enabled: backend && Boolean(source) })
  const action = useTransferAction()
  const busy = Boolean(action.attempt)
  const valid = !busy && source !== destination && Boolean(source && destination && vehicle && reason.trim()) && vehicles.isSuccess && !vehicles.isFetching && vehicles.data.data.some(v => String(v.id) === vehicle)
  return <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
    <Button asChild variant="secondary"><Link to="/doi-xe">{t('transfers.fleet')}</Link></Button><h1 className="my-4 text-h1 font-bold">{t('transfers.title')}</h1><p>{t('transfers.policy')}</p>
    {!backend ? <p>{t('transfers.backendOnly')}</p> : <>
      <form className="my-4 grid min-w-0 gap-4 rounded-lg border border-line bg-surface p-4" onSubmit={e => { e.preventDefault(); if (valid) setConfirm(true) }}>
        <label>{t('transfers.source')}<select className="block min-h-14 w-full rounded border border-line" value={source} disabled={busy} required onChange={e => { setSource(e.target.value); setVehicle(''); setPage(0) }}><option value="">{t('transfers.choose')}</option>{warehouses.data?.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
        <label>{t('transfers.vehicle')}<select className="block min-h-14 w-full rounded border border-line" required value={vehicle} disabled={busy || vehicles.isFetching} onChange={e => setVehicle(e.target.value)}><option value="">{t('transfers.choose')}</option>{vehicles.data?.data.map(v => <option key={v.id} value={v.id}>{v.license_plate} · {v.name}</option>)}</select></label>
        {vehicles.isSuccess && !vehicles.data.data.length ? <p>{t('transfers.noCandidates')}</p> : null}
        <div className="flex flex-wrap gap-3"><Button type="button" variant="secondary" disabled={busy || page === 0} onClick={() => { setPage(page - 1); setVehicle('') }}>{t('transfers.previous')}</Button><Button type="button" variant="secondary" disabled={busy || !vehicles.data || vehicles.data.last || vehicles.isFetching} onClick={() => { setPage(page + 1); setVehicle('') }}>{t('transfers.next')}</Button></div>
        <label>{t('transfers.destination')}<select className="block min-h-14 w-full rounded border border-line" required value={destination} disabled={busy} onChange={e => setDestination(e.target.value)}><option value="">{t('transfers.choose')}</option>{warehouses.data?.filter(w => String(w.id) !== source).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
        <label>{t('transfers.reason')}<textarea className="block min-h-20 w-full rounded border border-line" required maxLength={500} value={reason} disabled={busy} onChange={e => setReason(e.target.value)} /></label>
        <Button type="submit" size="touch" disabled={!valid}>{t('transfers.request')}</Button>
      </form>
      {warehouses.isError || vehicles.isError ? <p role="alert">{dataErrorMessage(warehouses.error ?? vehicles.error, t)}<Button variant="secondary" onClick={() => { void warehouses.refetch(); if (source) void vehicles.refetch() }}>{t('transfers.refresh')}</Button></p> : null}
      {action.error ? <p role="alert">{dataErrorMessage(action.error, t)} {t('transfers.uncertain')}<Button variant="secondary" disabled={action.pending} onClick={action.retry}>{t('transfers.retry')}</Button></p> : null}
      {action.success ? <p role="status">{t('transfers.recorded')}</p> : null}
      <TransferList />
      <ConfirmDialog open={confirm} onOpenChange={setConfirm} title={t('transfers.request')} description={t('transfers.policy')} cancelLabel={t('transfers.back')} confirmLabel={t('transfers.confirm')} onConfirm={() => { action.submit({ kind: 'request', payload: { vehicleId: Number(vehicle), sourceWarehouseId: Number(source), destinationWarehouseId: Number(destination), reason: reason.trim() }, key: crypto.randomUUID() }); setConfirm(false) }} />
    </>}
  </main>
}
