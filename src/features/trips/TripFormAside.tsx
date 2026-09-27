import { CircleCheck } from 'lucide-react'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import type { VehicleConfig } from '@/domain/models'
import { useFormat, useT } from '@/lib/i18n'
import type { Trip } from '@/lib/mock-db'
import { cargoSummary } from './trip-summary'

const CHECKS = ['name', 'vehicle', 'stops', 'cargo'] as const

/**
 * Cột phải của form chuyến: card danh sách tự kiểm trước khi lưu và một card tổng hợp. Chỉ số có nguồn: số điểm giao đếm theo
 * form đang nhập, tải trọng từ xe đang chọn, kiện và khối lượng từ chuyến đã lưu (tạo mới chưa có kiện — không hiện số bịa).
 */
export function TripFormAside({ stopCount, vehicle, existing }: {
  stopCount: number
  vehicle: VehicleConfig | undefined
  existing: Trip | undefined
}) {
  const t = useT()
  const format = useFormat()
  const cargo = existing && vehicle ? cargoSummary(existing.packages, vehicle) : null
  const rows = [
    { label: t('trips.create.summaryStops'), value: format.integer(stopCount) },
    { label: t('trips.create.summaryPayload'), value: vehicle ? format.weight(vehicle.maxPayloadKg) : null },
    ...(cargo ? [
      { label: t('trips.create.summaryPackages'), value: format.integer(cargo.instances) },
      { label: t('trips.create.summaryWeight'), value: format.weight(cargo.weightKg) },
    ] : []),
  ]

  return (
    <aside className="flex flex-col gap-5 xl:sticky xl:top-0">
      {/* Card nền đặc (V2.3 TaoChuyen.jpg): cột này bắt đầu ngay trên dải trời (PageHero overlap), chữ trần ở đó không đọc được */}
      <Card>
        <CardHeader>
          <CardTitle as="h2">{t('trips.create.checklistTitle')}</CardTitle>
        </CardHeader>
        <ol className="m-0 flex list-none flex-col gap-2.5 px-4.5 py-4">
          {CHECKS.map((check) => (
            <li key={check} className="flex items-start gap-2 text-body text-ink-2">
              <CircleCheck aria-hidden className="mt-0.5 size-4 flex-none text-ink-3" strokeWidth={1.5} />
              {t(`trips.create.checklist.${check}`)}
            </li>
          ))}
        </ol>
      </Card>

      <section aria-label={t('trips.create.summaryLabel')} className="flex flex-col rounded-lg border border-border bg-bg px-4.5 py-2 shadow-card">
        <dl className="m-0 flex flex-col">
          {rows.map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-3 border-b border-border py-3 last:border-b-0">
              <dt className="text-body text-ink-2">{row.label}</dt>
              {row.value === null ? (
                <dd className="m-0 text-body text-ink-3">{t('trips.create.summaryNoVehicle')}</dd>
              ) : (
                <dd className="m-0 text-h3 font-semibold text-ink-strong tabular-nums">{row.value}</dd>
              )}
            </div>
          ))}
        </dl>
        <p className="border-t border-border py-3 text-note text-ink-3">
          {existing ? t('trips.create.summaryNote') : t('trips.create.summaryNoteNew')}
        </p>
      </section>
    </aside>
  )
}
