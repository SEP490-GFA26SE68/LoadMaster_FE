import { useMemo } from 'react'
import { Badge } from '@/components/ui/Badge'
import { gt } from '@/domain/geometry'
import { axleLoadsOf, type AxleGroup, type AxleGroupLoad } from '@/domain/metrics'
import type { VehicleConfig } from '@/domain/models'
import { useFormat, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { cargoCenterOfMass } from '../operations/operations-model'
import type { ScenePlacement } from '../scene-input'

const GROUPS: readonly AxleGroup[] = ['front', 'rear']

/**
 * Tải trục trong inspector (FE-5b-03, D-78): tải nhóm trục trước / sau của **toàn bộ kiện đang xếp trong phương án** (kể cả bản đang
 * chỉnh tay) theo mô hình đòn bẩy của `axleLoadsOf`, so với giới hạn của loại xe hoặc của trục. Số là ước lượng của mock nên luôn mang
 * nhãn MOCK RESULT. Xe không đủ dữ liệu trục thì không có số nào — chỉ một câu nói vì sao chưa tính. Vượt giới hạn có chữ, không chỉ màu.
 */
export function AxleLoadPanel({ vehicle, placements, compact = false }: {
  vehicle: VehicleConfig
  placements: readonly ScenePlacement[]
  compact?: boolean
}) {
  const t = useT()
  const loads = useMemo(() => {
    const mass = cargoCenterOfMass(placements)
    return axleLoadsOf(vehicle, { totalKg: mass?.weightKg ?? 0, centerXCm: mass?.position.x })
  }, [vehicle, placements])
  return (
    <section
      aria-label={t('viewer.axles.title')}
      className={cn('flex min-w-64 flex-col gap-2 rounded-lg border border-glass-dark-border bg-canvas-2/45 p-3', compact ? 'w-70' : 'w-full')}
    >
      <div className="flex items-center justify-between gap-3 text-body-lg xl:text-caption">
        <span className="font-semibold text-sky-text">{t('viewer.axles.title')}</span>
        {loads.status === 'computed' ? <Badge shape="tag" tone="mock" className="border-amber-500/45 text-amber-500">MOCK RESULT</Badge> : null}
      </div>
      {loads.status === 'computed' ? (
        <>
          <dl className="m-0 flex flex-col gap-1.5 text-body-lg xl:text-caption">
            {GROUPS.map((group) => <GroupRow key={group} group={group} load={loads[group]} />)}
          </dl>
          {!compact ? <p className="text-body-lg text-glass-dark-muted xl:text-caption">{t('viewer.axles.model')}</p> : null}
        </>
      ) : (
        <p className="text-body-lg text-glass-dark-muted xl:text-caption">{t(`viewer.axles.unavailable.${loads.reason}`)}</p>
      )}
    </section>
  )
}

function GroupRow({ group, load }: { group: AxleGroup; load: AxleGroupLoad }) {
  const t = useT()
  const format = useFormat()
  const { loadKg, limitKg } = load
  const over = limitKg !== undefined && gt(loadKg, limitKg)
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
      <dt className="text-glass-dark-muted">{t(`viewer.axles.groups.${group}`)}</dt>
      <dd className={cn('m-0 flex flex-col items-end text-right', over ? 'text-red-200' : 'text-sky-text')}>
        <span className="font-mono tabular-nums">
          {limitKg === undefined
            ? t('viewer.axles.loadNoLimit', { load: format.weight(loadKg) })
            : t('viewer.axles.loadOfLimit', { load: format.weight(loadKg), limit: format.weight(limitKg) })}
        </span>
        {over ? <span className="font-semibold">{t('viewer.axles.over', { over: format.weight(loadKg - limitKg) })}</span> : null}
      </dd>
    </div>
  )
}
