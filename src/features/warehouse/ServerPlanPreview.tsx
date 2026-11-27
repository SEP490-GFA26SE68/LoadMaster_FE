import { lazy, Suspense, useMemo } from 'react'
import { Spinner } from '@/components/ui/Spinner'
import { useT } from '@/lib/i18n'
import { serverSessionScene } from './server-session-scene'
import type { ServerLoadingSession } from './warehouse-dto'

const PositionViewer = lazy(() => import('@/features/viewer3d/PositionViewer').then((m) => ({ default: m.PositionViewer })))

/** Read-only geometry. Selected is inspection; actual outcomes come only from the server. */
export function ServerPlanPreview({ session, selectedId, onSelect }: {
  session: ServerLoadingSession; selectedId: string | null; onSelect: (id: string | null) => void
}) {
  const t = useT()
  const scene = useMemo(() => serverSessionScene(session), [session])
  const confirmedIds = useMemo(() => new Set(session.placements.flatMap((p) =>
    session.outcomes[p.id] === 'confirmed' || session.outcomes[p.id] === 'deviation'
      ? scene?.sceneIdOf.get(p.id) ?? [] : [])), [session, scene])
  if (scene === null) return <p role="alert" className="rounded-lg border border-border bg-bg p-4 text-body-lg">{t('serverWarehouse.guide.sceneUnavailable')}</p>
  if (typeof WebGLRenderingContext === 'undefined') return <p role="status">{t('serverWarehouse.guide.webglUnavailable')}</p>
  const placementIdOf = new Map([...scene.sceneIdOf].map(([id, sceneId]) => [sceneId, id]))
  return <section aria-label={t('serverWarehouse.guide.sceneTitle')} data-load-plan-id={session.loadPlanId} className="h-120 min-w-0 lg:h-full lg:min-h-140">
    <Suspense fallback={<div role="status" className="grid h-full place-items-center"><Spinner />{t('warehouse.viewerLoading')}</div>}>
      <PositionViewer model={scene.model} preview={{
        executionActive: session.executionStatus === 'IN_PROGRESS',
        selectedId: selectedId === null ? null : scene.sceneIdOf.get(selectedId) ?? null,
        confirmedIds, onSelect: (id) => onSelect(id === null ? null : placementIdOf.get(id) ?? null),
      }} vehicleBodyStyle={scene.vehicleBodyStyle} />
    </Suspense>
  </section>
}
