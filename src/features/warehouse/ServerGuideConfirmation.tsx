import { useRef, useState } from 'react'
import { PackageVerify, type VerifyCode, type VerifyOutcome } from '@/components/PackageVerify'
import { Button } from '@/components/ui/Button'
import { ApiError } from '@/lib/api-client'
import { dataErrorMessage, useT } from '@/lib/i18n'
import { serverLoadingView } from './server-loading'
import { useConfirmServerPlacementMutation } from './useServerWarehouseQuery'
import { codeMatches, fetchServerLoadingSession } from './warehouse-server-api'
import { previewGeometryKey } from './warehouse-position-guide'
import type { ServerLoadingSession } from './warehouse-dto'

const identityOf = (s: ServerLoadingSession) => JSON.stringify([s.tripId, s.loadPlanId, s.executionId, previewGeometryKey(s)])
const executable = (s: ServerLoadingSession) => s.executionStatus === 'IN_PROGRESS' && !!s.executionId &&
  !!s.loadPlanId && s.approved !== false && s.stale !== true && !s.completed && s.stagingComplete && s.pendingManual === 0

/** Existing CODE mutation/adapter owns POST→GET. Inspection never enters this component's target selection. */
export function ServerGuideConfirmation({ tripId, session, fetching, refresh, setWriting }: {
  tripId: string; session: ServerLoadingSession; fetching: boolean
  refresh: () => Promise<ServerLoadingSession>; setWriting: (busy: boolean) => void
}) {
  const t = useT()
  const confirm = useConfirmServerPlacementMutation(tripId)
  const busy = useRef(false)
  const [pending, setPending] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [unverified, setUnverified] = useState(false)
  const [openTarget, setOpenTarget] = useState<string | null>(null)
  const [result, setResult] = useState<VerifyOutcome | null>(null)
  const next = serverLoadingView(session).current
  const allowed = executable(session) && !!next?.packageCode?.trim()

  async function verify({ code, method }: VerifyCode) {
    if (busy.current || attempted || fetching || unverified || !allowed || !next || method !== 'CODE' || openTarget !== next.id) return
    if (!codeMatches(next, code, 'CODE')) {
      setResult({ tone: 'error', message: t('serverWarehouse.session.codeUnmatched', { code: code.trim(), name: next.name }) })
      return
    }
    // Freeze this action's target/context. Never retarget a typed code to a new next package.
    const target = next
    const identity = identityOf(session)
    busy.current = true
    setPending(true)
    setWriting(true)
    setResult(null)
    let posted = false
    try {
      // Fresh GET before writing also invalidates an open dialog if the execution changed.
      const fresh = await refresh()
      if (identityOf(fresh) !== identity || !executable(fresh) ||
          serverLoadingView(fresh).current?.id !== target.id ||
          !codeMatches(fresh.placements.find(p => p.id === target.id) ?? target, code, 'CODE'))
        throw new ApiError('CONFLICT', { status: 409 })
      posted = true
      setAttempted(true)
      const verified = await confirm.mutateAsync({ placementId: target.id, method: 'CODE', code: code.trim() })
      const current = await refresh()
      if (identityOf(verified) !== identity || identityOf(current) !== identity ||
          verified.outcomes[target.id] !== 'confirmed' || current.outcomes[target.id] !== 'confirmed')
        throw new ApiError('CONFLICT', { status: 409 })
      setOpenTarget(null) // Input resets only after verified outcome or invalidated context.
      setResult({ tone: 'success', message: t('serverWarehouse.session.confirmed', { name: target.name }) })
    } catch (error) {
      // Never retry POST after an ambiguous ACK. Reconcile real session and current approved plan by GET.
      if (posted) {
        try {
          await fetchServerLoadingSession(tripId)
          await refresh()
        } catch (reconcileError) {
          setResult({ tone: 'error', message: dataErrorMessage(reconcileError, t) })
          setUnverified(true)
          return
        }
      }
      setResult({ tone: 'error', message: dataErrorMessage(error, t) + (posted ? ' ' + t('serverWarehouse.guide.reopenToRetry') : '') })
    } finally {
      busy.current = false
      setPending(false)
      setWriting(false)
    }
  }

  return <section aria-label={t('serverWarehouse.guide.executionGuide')} className="rounded-lg border border-border bg-bg p-4">
    <h2 className="m-0 text-h3 font-semibold">{t('serverWarehouse.guide.executionGuide')}</h2>
    <p>{t(session.completed ? 'serverWarehouse.guide.completed' : 'serverWarehouse.guide.confirmHint')}</p>
    {allowed && next ? <Button size="touch" className="h-auto min-h-14 w-full whitespace-normal"
      disabled={fetching || pending || unverified} onClick={() => { setResult(null); setAttempted(false); setOpenTarget(next.id) }}>
      {t('serverWarehouse.guide.enterCode', { step: next.sequence })}
    </Button> : null}
    {!next?.packageCode?.trim() && next && executable(session) ? <p role="status">{t('serverWarehouse.guide.missingCode')}</p> : null}
    {session.pendingManual > 0 ? <p role="status">{t('serverWarehouse.session.manualPending')}</p> : null}
    {unverified ? <Button size="touch" disabled={pending || fetching} onClick={() => {
      if (busy.current) return
      busy.current = true
      setPending(true)
      setWriting(true)
      void fetchServerLoadingSession(tripId).then(() => refresh()).then(() => {
        setUnverified(false)
        setResult(null)
      }).catch(error => setResult({ tone: 'error', message: dataErrorMessage(error, t) })).finally(() => {
        busy.current = false; setPending(false); setWriting(false)
      })
    }}>{t('serverWarehouse.guide.reconcile')}</Button> : null}
    <p>{t('serverWarehouse.guide.exceptionsLink')}</p>
    {result && openTarget !== next?.id ? <p role={result.tone === 'error' ? 'alert' : 'status'}>{result.message}</p> : null}
    {allowed && next ? <PackageVerify key={next.id} open={openTarget === next.id}
      onOpenChange={open => { if (!busy.current) setOpenTarget(open ? next.id : null) }}
      title={t('serverWarehouse.session.verifyTitle', { step: next.sequence })}
      description={t('serverWarehouse.guide.confirmHint')} methods={['CODE']} queueWhilePending={false}
      codeLabel={t('serverWarehouse.session.codeLabel')} codeHint={t('serverWarehouse.session.codeHint')}
      submitLabel={t('serverWarehouse.guide.confirmPlaced')} onVerify={input => void verify(input)}
      onManual={() => { /* No manual fallback in the CODE flow. Use the existing session. */ }}
      candidates={[]} pending={pending || fetching} disabled={unverified || attempted} result={result} /> : null}
  </section>
}
