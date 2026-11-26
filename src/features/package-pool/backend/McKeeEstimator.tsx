import { zodResolver } from '@hookform/resolvers/zod'
import type { KeyboardEvent } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useFormat, useT, type MessageKey } from '@/lib/i18n'

import { estimateTopLoadCapacity } from './top-load-capacity'

/**
 * Trợ giúp ước tính σ cho thùng carton (spec ràng buộc vật lý 8.3), đặt trong form loại kiện của máy chủ. Form riêng (react-hook-form +
 * zod) không có nút gửi: nằm trong `<form>` của hộp thoại nên Enter ở ô của nó bị chặn, không lưu nhầm loại kiện. Độ dày nhập bằng mm và
 * đổi sang cm ngay ở đây; chu vi đáy và diện tích mặt trên lấy từ dài, rộng của loại kiện. "Dùng giá trị này" chỉ điền ô σ, không lưu.
 */

const POSITIVE = 'physicalData.errors.positive' satisfies MessageKey
const positive = z.number({ error: POSITIVE }).gt(0, { error: POSITIVE })

const schema = z.object({ ectNPerM: positive, thicknessMm: positive, safetyFactor: positive })
type EstimatorValues = z.infer<typeof schema>
type EstimatorField = keyof EstimatorValues

const EMPTY: EstimatorValues = { ectNPerM: Number.NaN, thicknessMm: Number.NaN, safetyFactor: Number.NaN }

const FIELDS: readonly { name: EstimatorField; label: MessageKey; suffix: string; step: string; hint?: MessageKey }[] = [
  { name: 'ectNPerM', label: 'physicalData.mckee.ect', suffix: 'N/m', step: '1', hint: 'physicalData.mckee.ectHint' },
  { name: 'thicknessMm', label: 'physicalData.mckee.thickness', suffix: 'mm', step: '0.1' },
  { name: 'safetyFactor', label: 'physicalData.mckee.safetyFactor', suffix: '', step: '0.1', hint: 'physicalData.mckee.safetyFactorHint' },
]

const MM_PER_CM = 10

function stopEnter(event: KeyboardEvent<HTMLInputElement>) {
  if (event.key === 'Enter') event.preventDefault()
}

export function McKeeEstimator({ lengthCm, widthCm, onUse }: {
  lengthCm: number
  widthCm: number
  onUse: (topLoadCapacityKgM2: number) => void
}) {
  const t = useT()
  const format = useFormat()
  const form = useForm<EstimatorValues>({ resolver: zodResolver(schema), mode: 'onChange', defaultValues: EMPTY })
  const [ectNPerM, thicknessMm, safetyFactor] = useWatch({ control: form.control, name: ['ectNPerM', 'thicknessMm', 'safetyFactor'] })
  const errors = form.formState.errors
  const hasDimensions = Number.isFinite(lengthCm) && Number.isFinite(widthCm) && lengthCm > 0 && widthCm > 0
  const estimate = hasDimensions
    ? estimateTopLoadCapacity({ ectNPerM, thicknessCm: thicknessMm / MM_PER_CM, lengthCm, widthCm, safetyFactor })
    : null

  return (
    <div className="flex flex-col gap-3">
      <p className="text-small text-ink-2">{t('physicalData.mckee.description')}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {FIELDS.map(({ name, label, suffix, step, hint }) => {
          const message = errors[name]?.message
          return (
            <Input
              key={name}
              label={t(label)}
              hint={hint ? t(hint) : undefined}
              numeric
              suffix={suffix || undefined}
              type="number"
              step={step}
              min={0}
              className="text-left"
              error={message ? t(message as MessageKey) : undefined}
              onKeyDown={stopEnter}
              {...form.register(name, { valueAsNumber: true })}
            />
          )
        })}
      </div>

      {!hasDimensions ? (
        <p className="text-small text-ink-2">{t('physicalData.mckee.needDimensions')}</p>
      ) : estimate === null ? (
        <p className="text-small text-ink-2">{t('physicalData.mckee.needInputs')}</p>
      ) : (
        <div className="flex flex-wrap items-end justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2.5">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-small" data-mckee-result>
            <dt className="text-ink-3">{t('physicalData.mckee.perimeter')}</dt>
            <dd className="font-mono tabular-nums">{format.ratio(estimate.perimeterM)} m</dd>
            <dt className="text-ink-3">{t('physicalData.mckee.area')}</dt>
            <dd className="font-mono tabular-nums">{format.ratio(estimate.topAreaM2)} m²</dd>
            <dt className="text-ink-3">{t('physicalData.mckee.boxCompression')}</dt>
            <dd className="font-mono tabular-nums">{format.integer(Math.round(estimate.boxCompressionN))} N</dd>
            <dt className="font-medium text-ink-1">{t('physicalData.mckee.result')}</dt>
            <dd className="font-mono font-medium text-ink-strong tabular-nums">{format.ratio(estimate.topLoadCapacityKgM2)} kg/m²</dd>
          </dl>
          <Button type="button" variant="secondary" size="sm" onClick={() => onUse(estimate.topLoadCapacityKgM2)}>
            {t('physicalData.mckee.use')}
          </Button>
        </div>
      )}

      <p className="text-fine text-ink-3">{t('physicalData.mckee.formula')}</p>
      <p className="text-fine text-ink-2">{t('physicalData.mckee.limits')}</p>
    </div>
  )
}
