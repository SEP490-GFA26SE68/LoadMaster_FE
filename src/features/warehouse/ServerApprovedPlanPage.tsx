import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/Button'
import { dataErrorMessage, useT } from '@/lib/i18n'
import { fetchServerApprovedPlan } from './warehouse-server-api'
import { serverLoadingView } from './server-loading'
import { ServerPlanPreview } from './ServerPlanPreview'
import { ServerPositionGuide } from './ServerPositionGuide'
import { ServerGuideConfirmation } from './ServerGuideConfirmation'
import { previewGeometryKey } from './warehouse-position-guide'
import type { ServerLoadingSession } from './warehouse-dto'

export function ServerApprovedPlanPage({ tripId }: { tripId: string }) {
  const t = useT()
  const [writing, setWriting] = useState(false)
  const [openedAt] = useState(() => Date.now())
  const query = useQuery({
    queryKey: ['warehouse', 'server', 'approved-plan', tripId],
    queryFn: () => fetchServerApprovedPlan(tripId),
    staleTime: 0, retry: false, refetchIntervalInBackground: false,
    refetchInterval: (q) => writing || q.state.status === 'error' || Date.now() - openedAt > 20 * 60_000 ? false : 10_000,
  })
  return <div className="flex h-dvh flex-col bg-app text-body-lg text-ink-strong">
    <header className="sky flex flex-none flex-wrap items-center gap-3 px-4 py-3">
      <Button asChild variant="skySolid" size="touch"><Link to="/kho">{t('warehouse.backToList')}</Link></Button>
      <h1 className="m-0 min-w-0 flex-1 text-body-lg font-semibold text-sky-text">{query.data?.code ?? tripId}</h1>
      <span className="text-sky-text">{t(query.data?.executionStatus === 'IN_PROGRESS' ? 'serverWarehouse.guide.executionGuide' : 'serverWarehouse.guide.readOnly')}</span>
      <Button variant="skySolid" size="touch" disabled={query.isFetching || writing} onClick={() => void query.refetch()}>{t('serverWarehouse.guide.refresh')}</Button>
    </header>
    {query.isError ? <main className="grid flex-1 place-items-center p-6"><p role="alert">{dataErrorMessage(query.error, t)}</p></main> :
      query.data ? <PlanView tripId={tripId} session={query.data} fetching={query.isFetching || writing} setWriting={setWriting}
        refresh={async () => {
          const result = await query.refetch({ throwOnError: true })
          if (!result.data) throw new Error('Missing warehouse session')
          return result.data
        }} /> :
        <main role="status" className="grid flex-1 place-items-center">{t('warehouse.loading')}</main>}
  </div>
}

function PlanView({ tripId, session, fetching, setWriting, refresh }: {
  tripId: string; session: ServerLoadingSession; fetching: boolean
  setWriting: (value: boolean) => void; refresh: () => Promise<ServerLoadingSession>
}) {
  const t = useT()
  const geometryKey = useMemo(() => previewGeometryKey(session), [session])
  // Outcome updates preserve inspection. A plan/execution/geometry change requires explicit review.
  const identity = JSON.stringify([session.loadPlanId, session.executionId, geometryKey])
  const [review, setReview] = useState({ identity, accepted: true })
  if (review.identity !== identity) setReview({ identity, accepted: false })
  const [selection, setSelection] = useState({ geometryKey, id: null as string | null, changed: false })
  if (selection.geometryKey !== geometryKey) setSelection({ geometryKey, id: null, changed: true })
  const selectedId = selection.geometryKey === geometryKey ? selection.id : null
  const selected = session.placements.find((p) => p.id === selectedId)
  const view = serverLoadingView(session)
  const state = (['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'] as const).find((value) => value === session.executionStatus)
  const executionLabel = state ? t(`serverWarehouse.guide.states.${state}`) : t('serverWarehouse.unknown')
  const actualNext = session.executionStatus === 'IN_PROGRESS' && !session.completed ? view.current : undefined
  return <main className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-4 lg:grid-cols-[minmax(0,1fr)_26rem] lg:overflow-hidden">
    <div className="flex min-h-120 min-w-0 flex-col gap-3 lg:overflow-y-auto">
      {selection.changed ? <p role="status" className="m-0 rounded-lg border border-border bg-bg p-3">{t('serverWarehouse.guide.planChanged')}</p> : null}
      <ServerPlanPreview session={session} selectedId={selectedId} onSelect={(id) => setSelection({ ...selection, id })} />
    </div>
    <aside className="flex min-h-0 flex-col gap-4 lg:overflow-y-auto">
      <section className="rounded-lg border border-border bg-bg p-4">
        <h2 className="m-0 text-h3 font-semibold">{t('serverWarehouse.guide.selection')}</h2>
        <p className="my-2">{session.executionId == null ? t('serverWarehouse.guide.identityNoExecution', { plan: session.loadPlanId ?? '—', status: executionLabel }) : t('serverWarehouse.guide.identity', { plan: session.loadPlanId ?? '—', execution: session.executionId, status: executionLabel })}</p>
        <p className="my-2">{t('serverWarehouse.guide.backendProgress', { count: view.done, total: view.total })}</p>
        <p className="my-2">{session.stagingRequired && !session.stagingComplete ? t('serverWarehouse.guide.stagingFirst') : actualNext ? t('serverWarehouse.guide.actualNext', { code: actualNext.packageCode ?? actualNext.name, step: actualNext.sequence }) : t('serverWarehouse.guide.noNext')}</p>
        <p className="my-2 text-ink-2">{t('serverWarehouse.guide.selectionHint')}</p>
        <p className="my-2 text-ink-2">{t('serverWarehouse.guide.freshnessHint')}</p>
        <Button variant="secondary" size="touch" aria-pressed={selectedId === null} onClick={() => setSelection({ ...selection, id: null })}>{t('serverWarehouse.guide.allPackages')}</Button>
      </section>
      {review.identity !== identity || !review.accepted ? <section role="status" className="rounded-lg border border-border bg-bg p-4">
        <p>{t('serverWarehouse.guide.sessionChanged')}</p>
        <Button size="touch" onClick={() => setReview({ identity, accepted: true })}>{t('serverWarehouse.guide.reviewSession')}</Button>
      </section> : <ServerGuideConfirmation key={identity} tripId={tripId} session={session} fetching={fetching} refresh={refresh} setWriting={setWriting} />}
      <Button asChild variant="secondary" size="touch"><Link to={session.executionId ? '/kho?chuyen=' + encodeURIComponent(tripId) : '/kho'}>{t(session.executionId ? 'serverWarehouse.guide.backToExecution' : 'serverWarehouse.guide.startFromList')}</Link></Button>
      {selected ? <ServerPositionGuide box={session.box} placement={selected} /> : null}
      <section aria-label={t('serverWarehouse.session.list')} className="rounded-lg border border-border bg-bg p-4">
        <h2 className="m-0 mb-3 text-h3 font-semibold">{t('serverWarehouse.session.list')}</h2>
        {session.placements.length === 0 ? <p>{t('serverWarehouse.session.noPlacements')}</p> : null}
        <ol className="m-0 flex list-none flex-col gap-2 p-0">
          {session.placements.map((p) => <li key={p.id}>
            <Button variant="secondary" size="touch" className="h-auto min-h-14 w-full justify-start whitespace-normal text-left" aria-pressed={selectedId === p.id} onClick={() => setSelection({ ...selection, id: p.id })}>
              <span>#{p.sequence} · {p.packageCode ?? p.name}<br />{' '}<span className="font-normal text-ink-2">{t(`serverWarehouse.session.outcomes.${session.outcomes[p.id] ?? 'pending'}`)}
                {session.staging[p.id]?.manual?.status === 'PENDING' ? ' · ' + t('serverWarehouse.session.manualPending') : ''}</span></span>
            </Button>
          </li>)}
        </ol>
      </section>

    </aside>
  </main>
}
