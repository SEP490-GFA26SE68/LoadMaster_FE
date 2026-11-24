/**
 * Tối ưu chất xếp qua interface `OptimizationService` (Spec mục 11, D-30). UI không import file bên trong thư mục này.
 */
export { createOptimizationService, UnavailableOptimizationService } from './create-service'
export { runMockCandidates, type CandidatePlan, type CandidateProgress, type CandidateRun, type CandidateRunOptions } from './mock-candidates'
export { runMockOptimization, type MockRunOptions } from './mock-optimization'
export { MockOptimizationService } from './MockOptimizationService'
export type { CandidateOptions, OptimizationProgress, OptimizationService, OptimizeOptions } from './OptimizationService'
export { OptimizationServiceError, type OptimizationServiceErrorCode } from './service-errors'
export { handleWorkerRequest, type OptimizationWorker, type WorkerRequest, type WorkerResponse } from './worker-protocol'
export { WorkerOptimizationService, type WorkerServiceOptions } from './WorkerOptimizationService'
