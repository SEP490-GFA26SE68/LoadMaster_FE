import type { UseFormReturn } from 'react-hook-form'
import { useT } from '@/lib/i18n'
import { TRUCK_FIELDS, TRUCK_LIMITS, type TryFormValues } from './try-form'
import { TRY_FIELDSET, TRY_LEGEND, TryNumberInput } from './TryNumberInput'

/** Nhóm "Thùng xe": dài · rộng · cao lòng thùng (cm) và tải trọng (kg). Bản thử coi cửa, vật cản, trục xe thế nào nằm ở "Tính thế nào?" cuối form. */
export function TryTruckFields({ form }: { form: UseFormReturn<TryFormValues> }) {
  const t = useT()
  return (
    <fieldset className={TRY_FIELDSET}>
      <legend className={TRY_LEGEND}>{t('landingTry.truck.legend')}</legend>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {TRUCK_FIELDS.map((field) => (
          <TryNumberInput key={field} form={form} name={`truck.${field}`} label={t(`landingTry.truck.${field}`)} limits={TRUCK_LIMITS[field]} />
        ))}
      </div>
    </fieldset>
  )
}
