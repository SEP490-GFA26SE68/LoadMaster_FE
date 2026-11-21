// SUCCESS is a legacy terminal state, not proof that every package was packed.
// Probe its saved plans; never rewrite it to COMPLETED or infer a plan from status alone.
export function canFetchOptimizationPlans(status?: string): boolean {
  // NO_SOLUTION vẫn lưu phương án rỗng kèm kiện chưa xếp — cần đọc để báo ràng buộc cụ thể.
  return ['COMPLETED', 'PARTIAL', 'SUCCESS', 'NO_SOLUTION'].includes(status?.toUpperCase() ?? '')
}

export function getBackendJobStatusKey(status?: string) {
  switch (status?.toUpperCase()) {
    case 'PENDING': return 'optimization.backend.jobStatus.PENDING' as const
    case 'QUEUED': return 'optimization.backend.jobStatus.QUEUED' as const
    case 'RUNNING': return 'optimization.backend.jobStatus.RUNNING' as const
    case 'COMPLETED': return 'optimization.backend.jobStatus.COMPLETED' as const
    case 'SUCCESS': return 'optimization.backend.jobStatus.SUCCESS' as const
    case 'PARTIAL': return 'optimization.backend.jobStatus.PARTIAL' as const
    case 'NO_SOLUTION': return 'optimization.backend.jobStatus.NO_SOLUTION' as const
    case 'TIMEOUT': return 'optimization.backend.jobStatus.TIMEOUT' as const
    case 'FAILED': return 'optimization.backend.jobStatus.FAILED' as const
    case 'CANCELLED': return 'optimization.backend.jobStatus.CANCELLED' as const
    default: return 'optimization.backend.jobStatus.UNKNOWN' as const
  }
}
