import { TransferList } from '@/features/vehicle-transfers/TransferList'
import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthSafe } from '@/features/auth/AuthProvider'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { VehicleStatusBadge } from '@/features/fleet/VehicleStatusBadge'
import { Card } from '@/components/ui/Card'
import { useT, dataErrorMessage } from '@/lib/i18n'
import { checkInVehicle, confirmLoadingVehicle, presenceEvents, presenceWarehouses, listPresenceVehicles } from './vehicle-presence-api'

export function WarehouseVehicleCheckIn() {
  const user = useAuthSafe()?.user
  return user?.role === 'warehouse' && user.companyId ? <CheckIn key={`${user.companyId}:${user.id}`} scope={[user.companyId, user.id]} /> : null
}
function CheckIn({ scope }: { scope: readonly string[] }) {
  const t = useT()
  const cache = useQueryClient()
  const [warehouse, setWarehouse] = useState('')
  const [input, setInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [atWarehouse, setAtWarehouse] = useState(false)
  const [history, setHistory] = useState<number | null>(null)
  const [attempt, setAttempt] = useState<{ warehouse: string; vehicle: number; key: string; loadingTrip?: number } | null>(null)
  const actionRef = useRef<typeof attempt>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [changed, setChanged] = useState(false)
  const warehouses = useQuery({ queryKey: ['vehicle-presence', ...scope, 'warehouses'], queryFn: presenceWarehouses })
  const assigned = warehouses.data?.some(w => String(w.id) === warehouse) ?? false
  const vehicles = useQuery({ queryKey: ['vehicle-presence', ...scope, warehouse, 'vehicles', search, page, atWarehouse], queryFn: () => listPresenceVehicles(warehouse, search, page, atWarehouse), enabled: Boolean(warehouse && assigned) })
  const events = useQuery({ queryKey: ['vehicle-presence', ...scope, warehouse, 'events', history], queryFn: () => presenceEvents(warehouse, history!), enabled: Boolean(warehouse && assigned && history !== null) })
  const confirm = useMutation({
    mutationFn: (action: NonNullable<typeof attempt>) => action.loadingTrip ? confirmLoadingVehicle(action.warehouse, action.loadingTrip, action.vehicle, action.key) : checkInVehicle(action.warehouse, action.vehicle, action.key),
    onSuccess: async (result, action) => {
      const atWarehouse = result.status === 'AT_WAREHOUSE' && result.warehouseId === Number(action.warehouse)
      setConfirmed(atWarehouse); setChanged(!atWarehouse); setAttempt(null); actionRef.current = null
      await Promise.all([cache.invalidateQueries({ queryKey: ['vehicle-presence', ...scope] }), cache.invalidateQueries({ queryKey: ['trips', 'departure-options'] })])
    },
    onError: () => { void vehicles.refetch() },
  })
  const start = (vehicle: number, loadingTrip?: number) => {
    if (actionRef.current || confirm.isPending) return
    const action = { warehouse, vehicle, loadingTrip, key: crypto.randomUUID() }
    actionRef.current = action; setAttempt(action); setConfirmed(false); setChanged(false); confirm.mutate(action)
  }
  return <Card className="mx-auto mb-6 w-full max-w-(--shell-max) p-4 text-body-lg [&_label]:text-body-lg">
    <section aria-label={t('warehouse.presence.title')}><h2 className="mb-3 font-semibold">{t('warehouse.presence.title')}</h2>
      <p>{t('warehouse.presence.description')}</p>
      {warehouses.isError ? <p role="alert">{dataErrorMessage(warehouses.error, t)} <Button variant="secondary" size="touch" onClick={() => void warehouses.refetch()}>{t('warehouse.retry')}</Button></p> : null}
      {warehouses.isSuccess && warehouses.data.length === 0 ? <p role="status">{t('warehouse.presence.noScope')}</p> : null}
      <label className="flex items-center gap-3"><input type="checkbox" className="size-6" checked={atWarehouse} disabled={Boolean(attempt)} onChange={e => { setAtWarehouse(e.target.checked); setPage(0) }} />{t('transfers.presentOnly')}</label>
      <label className="flex flex-col gap-2">{t('warehouse.presence.warehouse')}
        <select aria-label={t('warehouse.presence.warehouse')} className="min-h-14 rounded-md border border-line bg-bg px-3" value={warehouse} disabled={Boolean(attempt) || warehouses.isPending} onChange={e => { setWarehouse(e.target.value); setInput(''); setSearch(''); setPage(0); setHistory(null); setConfirmed(false); setChanged(false) }}>
          <option value="">{t('warehouse.presence.choose')}</option>
          {warehouses.data?.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </label>
      <form className="mt-3 flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); setSearch(input.trim()); setPage(0); setHistory(null); setConfirmed(false); setChanged(false) }}>
        <Input className="h-14 text-body-lg" label={t('warehouse.presence.search')} value={input} onChange={e => setInput(e.target.value)} disabled={!assigned || Boolean(attempt)} maxLength={80} />
        <Button type="submit" variant="secondary" size="touch" disabled={!assigned || (input.trim().length > 0 && input.trim().length < 2) || Boolean(attempt)}>{t('warehouse.presence.find')}</Button>
      </form>
      {!warehouse ? <p className="mt-4">{t('warehouse.presence.selectHint')}</p> : !assigned && !warehouses.isPending ? <p role="alert">{t('warehouse.presence.scopeChanged')}</p> : null}
      {assigned ? <Button className="mt-3" variant="secondary" size="touch" disabled={vehicles.isFetching || Boolean(attempt)} onClick={() => void cache.invalidateQueries({ queryKey: ['vehicle-presence', ...scope] })}>{t('warehouse.presence.refresh')}</Button> : null}
      {vehicles.isFetching ? <p role="status">{t('warehouse.presence.loading')}</p> : null}
      {vehicles.isError ? <p role="alert">{dataErrorMessage(vehicles.error, t)}</p> : null}
      {vehicles.isSuccess && vehicles.data.data.length === 0 ? <p role="status">{t('warehouse.presence.empty')}</p> : null}
      {confirmed ? <p role="status">{t('warehouse.presence.saved')}</p> : null}
      {changed ? <p role="alert">{t('warehouse.presence.changed')}</p> : null}
      {confirm.isError ? <p role="alert">{dataErrorMessage(confirm.error, t)} {t('warehouse.presence.uncertain')}</p> : null}
      {attempt && confirm.isError ? <Button variant="secondary" size="touch" onClick={() => confirm.mutate(attempt)}>{t('warehouse.presence.retry')}</Button> : null}
      {assigned && vehicles.data ? <h2 className="mt-4 font-semibold">{t('warehouse.presence.companyVehicles', { count: vehicles.data.totalElements })}</h2> : null}
      <ul className="m-0 list-none p-0">
        {(assigned ? vehicles.data?.data : [])?.map(v => <li key={v.id} className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <div className="min-w-0 flex-1"><strong className="break-words">{v.license_plate} · {v.name}</strong><p>{t(`warehouse.presence.status.${v.presence_status}`)}{v.current_warehouse_id !== null ? ` · ${v.current_warehouse_name ?? `#${v.current_warehouse_id}`}` : ''}</p>
            {v.presence_status === 'UNKNOWN' && v.loading_trip_id ? <p>{t('warehouse.presence.loadingVerificationHint')}</p> : null}{v.active_transfer_status ? <p>{t('transfers.title')}: {v.active_transfer_status === 'REQUESTED' ? t('transfers.REQUESTED') : t('transfers.IN_TRANSIT')}</p> : null}<p className="flex flex-wrap items-center gap-2">{t('warehouse.presence.operation')}: <VehicleStatusBadge status={v.status} /> <code className="text-sm">{v.status}</code></p>
            <p>{t('warehouse.presence.lastConfirmed')}: {v.observed_at ? new Date(v.observed_at).toLocaleString() : t('warehouse.presence.notRecorded')} · {v.actor_name ?? t('warehouse.presence.notRecorded')}</p></div>
          <div className="flex min-w-0 max-w-full flex-wrap gap-2">
            <Button variant="secondary" size="touch" onClick={() => setHistory(v.id)}>{t('warehouse.presence.history')}</Button>
            <Button className="h-auto min-h-14 max-w-full whitespace-normal py-3" variant="secondary" size="touch" disabled={Boolean(v.active_transfer_status) || !assigned || Boolean(attempt) || confirm.isPending || vehicles.isError || vehicles.isFetching || (v.status !== 'AVAILABLE' && !(v.status === 'IN_TRIP' && v.presence_status === 'UNKNOWN' && v.loading_trip_id)) || (v.presence_status === 'AT_WAREHOUSE' && String(v.current_warehouse_id) !== warehouse)} onClick={() => start(v.id, v.presence_status === 'UNKNOWN' ? v.loading_trip_id ?? undefined : undefined)}>{v.presence_status === 'UNKNOWN' && v.loading_trip_id ? t('warehouse.presence.confirmLoading', { trip: v.loading_trip_code ?? `#${v.loading_trip_id}` }) : t('warehouse.presence.confirm')}</Button>
          </div>
        </li>)}
      </ul>
      {assigned && vehicles.data && vehicles.data.totalPages > 1 ? <nav aria-label={t('warehouse.presence.pagination')} className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="secondary" size="touch" disabled={page === 0 || vehicles.isFetching || Boolean(attempt)} onClick={() => { setPage(page - 1); setHistory(null); setConfirmed(false); setChanged(false) }}>{t('warehouse.presence.previous')}</Button>
        <span>{t('warehouse.presence.page', { page: page + 1, total: vehicles.data.totalPages })}</span>
        <Button variant="secondary" size="touch" disabled={vehicles.data.last || vehicles.isFetching || Boolean(attempt)} onClick={() => { setPage(page + 1); setHistory(null); setConfirmed(false); setChanged(false) }}>{t('warehouse.presence.next')}</Button>
      </nav> : null}
      {events.isError ? <p role="alert">{dataErrorMessage(events.error, t)}</p> : null}
      {assigned && history !== null && events.isSuccess ? <ol>{events.data.map(e => <li key={e.id}>{t(e.eventType === 'CHECK_IN' ? 'warehouse.presence.in' : 'warehouse.presence.out')} · #{e.warehouseId} · #{e.actorId} · {new Date(e.recordedAt).toLocaleString()}</li>)}</ol> : null}
      {assigned ? <TransferList warehouse={warehouse} /> : null}
    </section>
  </Card>
}
