import { useId, type ChangeEvent, type CSSProperties } from 'react'
import { useFormat, useT } from '@/lib/i18n'
import type { SliderRange } from './axle-demo'

/**
 * Một thanh trượt gốc của trình duyệt (`<input type="range">`): nhãn là tên truy cập đúng từng chữ, giá trị hiện ở `<output>` cạnh nhãn và
 * đọc bằng `aria-valuetext` (đã định dạng theo ngôn ngữ). Cao 44 px, 56 px trên máy cảm ứng; phím mũi tên đi một bước, Page Up / Page Down
 * mười bước, Home / End về hai đầu — hành vi sẵn có của ô `range`. Phần đã kéo tô bằng `--fill` (`axle.css`).
 */
function RangeField({ label, value, range, valueText, display, onChange }: {
  label: string
  value: number
  range: SliderRange
  valueText: string
  display: string
  onChange: (value: number) => void
}) {
  const id = useId()
  const fill = { '--fill': `${(((value - range.min) / (range.max - range.min)) * 100).toFixed(2)}%` } as CSSProperties
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => onChange(Number(event.currentTarget.value))
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
        <label htmlFor={id} className="text-body font-semibold text-ink-1 pointer-coarse:text-body-lg">{label}</label>
        <output htmlFor={id} className="font-mono text-body font-medium tabular-nums text-ink-strong pointer-coarse:text-body-lg">{display}</output>
      </div>
      <input
        id={id}
        type="range"
        min={range.min}
        max={range.max}
        step={range.step}
        value={value}
        aria-valuetext={valueText}
        onChange={handleChange}
        style={fill}
        className="ax-range focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      />
    </div>
  )
}

/** Hai thanh trượt của khối hàng: trọng tâm (cm từ vách trước) và khối lượng (kg, tới tải trọng của xe mẫu). */
export function AxleControls({ centerXCm, totalKg, center, weight, onCenter, onWeight }: {
  centerXCm: number
  totalKg: number
  center: SliderRange
  weight: SliderRange
  onCenter: (value: number) => void
  onWeight: (value: number) => void
}) {
  const t = useT()
  const format = useFormat()
  const centerText = t('landingAxle.controls.centerValue', { value: format.length(centerXCm) })
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0">
      <legend className="sr-only">{t('landingAxle.controls.title')}</legend>
      <RangeField label={t('landingAxle.controls.center')} value={centerXCm} range={center} valueText={centerText}
        display={format.length(centerXCm)} onChange={onCenter} />
      <RangeField label={t('landingAxle.controls.weight')} value={totalKg} range={weight} valueText={format.weight(totalKg)}
        display={format.weight(totalKg)} onChange={onWeight} />
    </fieldset>
  )
}
