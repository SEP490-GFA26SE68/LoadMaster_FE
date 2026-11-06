import { useMutation } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { isApiError } from '@/lib/api-client'
import { createBackendOptimizationJob } from './optimization-api'
import {
  restoreOptimizationAction, saveOptimizationAction,
  type InitialOptimizationAction, type OptimizationActionScope,
} from './initial-optimization-action'

type Notice = 'uncertain' | 'conflict' | 'storage' | null

/** One mounted instance belongs to exactly one user/company/trip (the screen keys that boundary). */
export function useInitialOptimizationAction(scope: OptimizationActionScope) {
  const [restored] = useState(() => {
    try {
      const action = restoreOptimizationAction(scope)
      return { action, notice: action && (!action.jobId || action.dispatchStatus === 'UNKNOWN') ? 'uncertain' as Notice : null }
    }
    catch { return { action: null, notice: 'storage' as Notice } }
  })
  const [action, setAction] = useState<InitialOptimizationAction | null>(restored.action)
  const [notice, setNotice] = useState<Notice>(restored.notice)
  const active = useRef(action)
  const locked = useRef(false)
  const request = useRef<AbortController | null>(null)
  useEffect(() => () => request.current?.abort(), [])

  const mutation = useMutation({
    retry: false, // A retry is an explicit action using the immutable snapshot below.
    mutationFn: ({ snapshot, controller }: { snapshot: InitialOptimizationAction; controller: AbortController }) =>
      createBackendOptimizationJob(snapshot.request.tripId, snapshot.key, controller.signal),
    onSuccess: (job, { snapshot, controller }) => {
      if (controller.signal.aborted || active.current?.key !== snapshot.key) return
      const acknowledged = { ...snapshot, jobId: job.job_id, dispatchStatus: job.dispatch_status }
      active.current = acknowledged
      setAction(acknowledged)
      try {
        saveOptimizationAction(scope, acknowledged)
        setNotice(job.dispatch_status === 'UNKNOWN' ? 'uncertain' : null)
      } catch { setNotice('storage') }
    },
    onError: (error, { controller }) => {
      if (controller.signal.aborted) return
      setNotice(isApiError(error) && error.status === 409 ? 'conflict' : 'uncertain')
    },
    onSettled: () => { locked.current = false },
  })

  function submit(snapshot: InitialOptimizationAction) {
    const controller = new AbortController()
    request.current = controller
    locked.current = true // Synchronous, before React renders the pending state.
    mutation.mutate({ snapshot, controller })
  }

  function handleStartNew(resolvedJobId: string | null) {
    if (locked.current || notice === 'storage') return
    const previous = active.current
    if (previous && (!previous.jobId || previous.jobId !== resolvedJobId)) return
    try {
      const next: InitialOptimizationAction = { key: crypto.randomUUID(), request: { tripId: scope.tripId } }
      saveOptimizationAction(scope, next) // Persist BEFORE POST, even if the response will be lost.
      active.current = next
      setAction(next)
      setNotice(null)
      submit(next)
    } catch { setNotice('storage') }
  }

  function handleRetry() {
    const snapshot = active.current
    // Once a job is acknowledged, retry means GET/poll in the caller, never another POST.
    if (locked.current || notice === 'storage' || !snapshot || snapshot.jobId) return
    submit(snapshot)
  }

  return { action, notice, isPending: mutation.isPending, handleStartNew, handleRetry }
}
