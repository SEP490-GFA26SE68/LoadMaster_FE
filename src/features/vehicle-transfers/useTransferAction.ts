import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { performTransfer, type TransferAction } from './vehicle-transfer-api'
/** Account-scoped owner remounts this hook. Uncertain writes retain the original action and UUID. */
export function useTransferAction() {
  const cache = useQueryClient()
  const held = useRef<TransferAction | null>(null)
  const [attempt, setAttempt] = useState<TransferAction | null>(null)
  const mutation = useMutation({ mutationFn: performTransfer,
    onSuccess: async () => { held.current = null; setAttempt(null); await refresh() },
    onError: () => { void refresh() },
  })
  const refresh = () => Promise.all([['vehicle-transfers'], ['vehicle-presence'], ['trips'], ['vehicles']].map(queryKey => cache.invalidateQueries({ queryKey })))
  function submit(action: TransferAction) { if (held.current) return; held.current = action; setAttempt(action); mutation.mutate(action) }
  function retry() { if (held.current && !mutation.isPending) mutation.mutate(held.current) }
  return { submit, retry, attempt, pending: mutation.isPending, error: mutation.error, success: mutation.isSuccess }
}
