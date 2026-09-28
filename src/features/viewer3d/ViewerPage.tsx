import { useMemo } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/Button'
import { useT } from '@/lib/i18n'
import { benchmarkCountFromSearch, createBenchmarkInput, type BenchmarkCount } from './benchmark.mock'
import { benchmarkObstacleCountFromSearch, withBenchmarkObstacles, type BenchmarkObstacleCount } from './benchmark-obstacles.mock'
import { adaptResult } from './scene-input'
import { usePlanSourceQuery } from './usePlanSourceQuery'
import type { PlanSource } from './viewer-api'
import { ViewerSession } from './ViewerSession'
import { ViewerSkeleton } from './ViewerSkeleton'

/**
 * Xem phương án 3D — toàn màn, không có nav rail (theo bản design). Trang này chỉ chọn nguồn dữ liệu:
 * revision đã lưu của chuyến (LM-030, LM-049) hoặc fixture benchmark khi `?debug&packages=N`.
 */
export function ViewerPage() {
  const [searchParams] = useSearchParams()
  const count = benchmarkCountFromSearch(searchParams.toString())
  const obstacles = benchmarkObstacleCountFromSearch(searchParams.toString()) ?? 0
  return count ? <BenchmarkSession count={count} obstacles={obstacles} /> : <ResultSession />
}

/** `?debug&packages=N[&obstacles=0|1|20]`: fixture renderer, không đọc kho. */
function BenchmarkSession({ count, obstacles }: { count: BenchmarkCount; obstacles: BenchmarkObstacleCount }) {
  const model = useMemo(() => {
    const input = withBenchmarkObstacles(createBenchmarkInput(count), obstacles)
    return adaptResult({ trip: input.trip, revision: input })
  }, [count, obstacles])
  return <ViewerSession key={`${model.tripId}:${obstacles}`} model={model} />
}

/** Phương án đã lưu của chuyến: revision đã duyệt mới nhất, hoặc `?revision=<jobId>`. */
function ResultSession() {
  const { tripId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const t = useT()
  const query = usePlanSourceQuery(tripId, searchParams.get('revision') ?? undefined)
  if (query.isPending) {
    return <div className="relative h-dvh bg-canvas-1"><ViewerSkeleton packageCount={0} stopCount={0} /></div>
  }
  const revision = query.data?.revision
  if (!query.data || !revision) {
    return (
      <div className="flex h-dvh flex-col bg-bg p-8">
        <EmptyState
          mascot={query.isError ? 'error' : 'empty'}
          title={query.isError ? t('viewer.plan.loadErrorTitle') : t('viewer.plan.emptyTitle')}
          description={query.isError ? t('viewer.plan.loadErrorDescription', { tripId }) : t('viewer.plan.emptyDescription')}
          action={<Button variant={query.isError ? 'secondary' : 'primary'} asChild>
            <Link to={query.isError ? '/chuyen' : `/chuyen/${tripId}/toi-uu`}>{query.isError ? t('common.backToTrips') : t('viewer.plan.toSetup')}</Link>
          </Button>}
        />
      </div>
    )
  }
  // Snapshot mới là một phiên mới: draft, lựa chọn, lát cắt và phát lại không mang sang.
  return <LoadedResult key={revision.id} source={{ trip: query.data.trip, revision }} />
}

/** Pha chuyến đọc lại mỗi lần kho trả chuyến (kho bắt đầu xếp là khoá ngay), không thuộc snapshot của revision. */
function LoadedResult({ source }: { source: PlanSource }) {
  const model = useMemo(() => adaptResult(source), [source])
  return <ViewerSession model={model} phase={source.trip.phase} source={source} />
}
