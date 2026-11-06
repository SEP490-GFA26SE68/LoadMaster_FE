import { apiFetch } from '@/lib/api-client'

export type BackendOptimizationJob = {
  id?: number
  job_id?: string
  job_uuid?: string
  dispatch_status?: 'ACCEPTED' | 'UNKNOWN' | 'ALREADY_ACCEPTED'
  status?: string
}

export type BackendPackagePlacement = {
  id: number
  package_id: string
  step_sequence: number
  pos_x: number
  pos_y: number
  pos_z: number
  dim_x: number
  dim_y: number
  dim_z: number
  rotation_type: number
  stopZoneId: number | null
  stopZoneName: string | null
}

export type BackendLoadPlan = {
  id: number
  plan_name: string | null
  packed_items_count: number
  volume_utilization: number | null
  weight_utilization: number | null
  approved: boolean
  approved_by_id: number | null
  cogX: number | null
  cogY: number | null
  cogZ: number | null
  frontAxleLoad: number | null
  rearAxleLoad: number | null
  rehandlingCount: number
  placements: BackendPackagePlacement[]
}

type BackendApiResponse<T> = {
  success: boolean
  message: string | null
  data: T
}




export async function createBackendOptimizationJob(
  tripId: string,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<BackendOptimizationJob> {
  if (!idempotencyKey.trim()) throw new Error('OPTIMIZATION_ACTION_KEY_REQUIRED')
  signal?.throwIfAborted()
  const response = await apiFetch<
    BackendApiResponse<{ job_id: string; dispatch_status?: BackendOptimizationJob['dispatch_status'] }>
  >(
    `/api/trips/${encodeURIComponent(tripId)}/optimize-loading`,
    {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      signal,
    },
  )

  if (typeof response.data?.job_id !== 'string' || !response.data.job_id.trim()) {
    throw new Error('OPTIMIZATION_RESPONSE_UNKNOWN')
  }

  return {
    job_id: response.data.job_id.trim(),
    dispatch_status: response.data.dispatch_status,
  }
}





export async function fetchBackendOptimizationJob(
  jobId: string,
): Promise<BackendOptimizationJob> {
  const response = await apiFetch<
    BackendOptimizationJob | BackendApiResponse<BackendOptimizationJob>
  >(
    `/api/trips/optimization-jobs/${encodeURIComponent(jobId)}`,
  )

  return 'data' in response ? response.data : response
}



export async function fetchBackendLoadPlans(
  jobId: string,
): Promise<BackendLoadPlan[]> {
  const response = await apiFetch<
    BackendLoadPlan[] | BackendApiResponse<BackendLoadPlan[]>
  >(
    `/api/trips/optimization-jobs/${encodeURIComponent(jobId)}/plans`,
  )

  return Array.isArray(response)
    ? response
    : response.data
}
