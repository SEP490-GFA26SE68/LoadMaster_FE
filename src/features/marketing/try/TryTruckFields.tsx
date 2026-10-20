import { Truck } from 'lucide-react'
import { useWatch, type UseFormReturn } from 'react-hook-form'
import { Button } from '@/components/ui/Button'
import { useFormat, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { PUBLIC_TOUCH } from '../public-chrome'
import { readTruck, TRUCK_FIELDS, TRUCK_LIMITS, TRUCK_PRESETS, truckValues, type TruckPreset, type TryFormValues, type TryTruck } from './try-form'
import { TryNumberInput } from './TryNumberInput'

const CM_PER_M = 100
const KG_PER_TONNE = 1000

export const LEGEND = 'mb-3 flex items-center gap-2 p-0 font-display text-h3 leading-5.5 font-[650] text-ink-strong font-stretch-106%'
export const FIELDSET = 'm-0 min-w-0 border-0 p-0'
/** Chú thích dưới nhóm ô: nguồn số, giới hạn của bản thử. */
export const NOTE = 'm-0 text-small text-pretty text-ink-3 pointer-coarse:text-body-lg'

function sameTruck(a: TryTruck | null, b: TryTruck): boolean {
  return a !== null && TRUCK_FIELDS.every((field) => a[field] === b[field])
}

/**
 * Ba nút xe mẫu (`aria-pressed` khi form đang đúng số của xe đó). Theo dõi ô bằng `useWatch` ở đây để chỉ hàng nút vẽ lại theo từng phím.
 */
function TruckPresets({ form }: { form: UseFormReturn<TryFormValues> }) {
  const t = useT()
  const format = useFormat()
  const current = readTruck(useWatch({ control: form.control, name: 'truck' }))
  const choose = (preset: TruckPreset) => {
    const values = truckValues(preset.truck)
    for (const field of TRUCK_FIELDS) {
      form.setValue(`truck.${field}`, values[field], { shouldDirty: true, shouldValidate: form.formState.isSubmitted })
    }
  }
  return (
    <div role="group" aria-labelledby="try-truck-presets" className="flex flex-col gap-2">
      <span id="try-truck-presets" className="text-small font-semibold text-ink-2 pointer-coarse:text-body-lg">{t('landingTry.truck.presets')}</span>
      <div className="flex flex-wrap gap-2">
        {TRUCK_PRESETS.map((preset) => (
          <Button
            key={preset.id}
            type="button"
            variant="secondary"
            aria-pressed={sameTruck(current, preset.truck)}
            onClick={() => choose(preset)}
            className={cn(
              'h-11 tabular-nums aria-pressed:border-primary aria-pressed:bg-primary-bg aria-pressed:text-primary',
              PUBLIC_TOUCH,
            )}
          >
            <Truck aria-hidden strokeWidth={1.5} />
            {t('landingTry.truck.preset', {
              length: format.lengthValue(preset.truck.lengthCm / CM_PER_M),
              payload: format.lengthValue(preset.truck.payloadKg / KG_PER_TONNE),
            })}
          </Button>
        ))}
      </div>
      <p className={NOTE}>{t('landingTry.truck.presetsSource')}</p>
    </div>
  )
}

/** Nhóm "Lòng thùng xe": xe mẫu, dài · rộng · cao (cm), tải trọng (kg) và câu nói bản thử bỏ qua cửa, vật cản. */
export function TryTruckFields({ form }: { form: UseFormReturn<TryFormValues> }) {
  const t = useT()
  return (
    <fieldset className={FIELDSET}>
      <legend className={LEGEND}>{t('landingTry.truck.legend')}</legend>
      <div className="flex flex-col gap-4">
        <TruckPresets form={form} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {TRUCK_FIELDS.map((field) => (
            <TryNumberInput key={field} form={form} name={`truck.${field}`} label={t(`landingTry.truck.${field}`)} limits={TRUCK_LIMITS[field]} />
          ))}
        </div>
        <p className={NOTE}>{t('landingTry.truck.note')}</p>
      </div>
    </fieldset>
  )
}
