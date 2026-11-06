import { z } from 'zod'
import { backendConfig } from '@/lib/backend-config'

export type OptimizationActionScope = { userId: string; companyId: string; tripId: string }

const actionSchema = z.object({
  key: z.uuid(),
  request: z.object({ tripId: z.string().regex(/^[1-9]\d*$/) }).strict(),
  jobId: z.string().min(1).optional(),
  dispatchStatus: z.enum(['ACCEPTED', 'UNKNOWN', 'ALREADY_ACCEPTED']).optional(),
}).strict()

export type InitialOptimizationAction = z.infer<typeof actionSchema>

export function optimizationActionStorageKey(scope: OptimizationActionScope): string {
  return `loadmaster.initial-optimization.v1:${JSON.stringify([
    backendConfig.apiUrl, scope.userId, scope.companyId, scope.tripId,
  ])}`
}

export function restoreOptimizationAction(scope: OptimizationActionScope): InitialOptimizationAction | null {
  const raw = sessionStorage.getItem(optimizationActionStorageKey(scope))
  if (raw === null) return null
  const action = actionSchema.parse(JSON.parse(raw))
  if (action.request.tripId !== scope.tripId) throw new Error('OPTIMIZATION_ACTION_SCOPE_MISMATCH')
  return action
}

export function saveOptimizationAction(scope: OptimizationActionScope, action: InitialOptimizationAction): void {
  // Whitelist only action metadata. No token, user profile, cargo or credit data is stored.
  sessionStorage.setItem(optimizationActionStorageKey(scope), JSON.stringify(actionSchema.parse(action)))
}

export function isOptimizationTerminal(status?: string): boolean {
  return ['COMPLETED', 'SUCCESS', 'PARTIAL', 'NO_SOLUTION', 'FAILED', 'TIMEOUT', 'CANCELLED']
    .includes(status?.toUpperCase() ?? '')
}
