import { useId, type ReactNode } from 'react'
import { useWatch, type UseFormReturn } from 'react-hook-form'
import type { z } from 'zod'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { useFormat, useT } from '@/lib/i18n'
import type { Trip } from '@/lib/mock-db'
import { TripFormChecklist } from './TripFormChecklist'
import type { TripFormValues } from './trip-form.schema'
import type { VehicleOption } from './trips-api'
import { cargoSummary } from './trip-summary'

/**
 * Cột phải của form chuyến (V2.3): thẻ kiểm tra đọc trực tiếp form và thẻ "Tóm tắt chuyến". Chỉ số có nguồn: số điểm giao đếm theo
 * form đang nhập, xe từ ô chọn, kiện và khối lượng từ chuyến đã lưu (tạo mới chưa có kiện — không hiện số bịa).
 */
export function TripFormAside({ form, schema, selected, existing, locked }: {
  form: UseFormReturn<TripFormValues>
  schema: z.ZodType
  selected: VehicleOption | undefined
  existing: Trip | undefined
  locked: boolean
}) {
  return (
    <aside className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-0">
      <TripFormChecklist form={form} schema={schema} selected={selected} existing={existing} locked={locked} />
      <TripFormSummary form={form} selected={selected} existing={existing} />
    </aside>
  )
}

function TripFormSummary({ form, selected, existing }: {
  form: UseFormReturn<TripFormValues>
  selected: VehicleOption | undefined
  existing: Trip | undefined
}) {
  const t = useT()
  const format = useFormat()
  const titleId = useId()
  const stopCount = useWatch({ control: form.control, name: 'stops' })?.length ?? 0
  const vehicle = selected?.vehicle
  const cargo = existing && vehicle ? cargoSummary(existing.packages, vehicle) : null
  const rows: { label: string; value: ReactNode; big?: boolean }[] = [
    { label: t('trips.create.summaryVehicle'), value: vehicle ? <VehicleLabel name={vehicle.name} /> : null },
    {
      label: t('trips.create.cargoSpace'),
      value: vehicle ? format.dimensions(vehicle.innerLengthCm, vehicle.innerWidthCm, vehicle.innerHeightCm) : null,
    },
    { label: t('trips.create.summaryPayload'), value: vehicle ? format.weight(vehicle.maxPayloadKg) : null, big: true },
    { label: t('trips.create.summaryStops'), value: format.integer(stopCount), big: true },
    ...(cargo ? [
      { label: t('trips.create.summaryPackages'), value: format.integer(cargo.instances), big: true },
      { label: t('trips.create.summaryWeight'), value: format.weight(cargo.weightKg), big: true },
    ] : []),
  ]

  return (
    <Card role="region" aria-labelledby={titleId}>
      <CardHeader>
        <CardTitle as="h2" id={titleId}>{t('trips.create.summaryLabel')}</CardTitle>
      </CardHeader>
      <dl className="m-0 flex flex-col px-4.5 pt-0.5 pb-1">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-4 border-t border-line-soft py-2.75 first:border-t-0">
            <dt className="text-lede whitespace-nowrap text-ink-3">{row.label}</dt>
            {row.value === null ? (
              <dd className="m-0 text-body text-ink-3">{t('trips.create.summaryNoVehicle')}</dd>
            ) : (
              <dd
                className={row.big
                  ? 'm-0 text-right font-display text-h3 leading-5 font-[650] text-ink-strong tabular-nums'
                  : 'm-0 text-right text-body font-semibold text-ink-strong tabular-nums'}
              >
                {row.value}
              </dd>
            )}
          </div>
        ))}
      </dl>
      {existing ? (
        <p className="border-t border-line-soft px-4.5 pt-2.75 pb-3.25 text-fine text-ink-3">{t('trips.create.summaryNote')}</p>
      ) : null}
    </Card>
  )
}

/** "Hyundai HD210 · 60C-446.32" thành tên xe và biển số mono (V2.3); tên không có biển số giữ nguyên. */
function VehicleLabel({ name }: { name: string }) {
  const cut = name.lastIndexOf(' · ')
  if (cut === -1) return <>{name}</>
  return (
    <>
      {name.slice(0, cut)}
      <span className="sr-only"> · </span>
      <span className="ml-1 font-mono text-caption font-normal whitespace-nowrap text-ink-3">{name.slice(cut + 3)}</span>
    </>
  )
}
