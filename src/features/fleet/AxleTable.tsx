import { Plus, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { useFieldArray, useFormState, useWatch, type Control, type UseFormRegister } from 'react-hook-form'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useT } from '@/lib/i18n'
import { newAxle, type VehicleFormValues } from './vehicle-form'
import { CM_STEP, KG_STEP, NUMERIC_FIELD_PROPS } from './VehicleSpecFields'

/** Cột kg của một trục, kèm key nhãn trong từ điển. */
const KG_COLUMNS = [
  ['emptyLoadKg', 'emptyLoad'],
  ['maxLoadKg', 'maxLoad'],
] as const

/**
 * Bảng trục xe, tuỳ chọn (Spec 7.10): vị trí, tải rỗng và tải tối đa của từng trục là đầu vào của mô hình tải trục (FE-5b-03, D-78).
 * Một dòng chữ nói dữ liệu này dùng vào đâu và trục nào được coi là trục trước.
 */
export function AxleTable({
  control,
  register,
}: {
  control: Control<VehicleFormValues>
  register: UseFormRegister<VehicleFormValues>
}) {
  const t = useT()
  const { fields, append, remove } = useFieldArray({ control, name: 'axles', keyName: 'rowKey' })
  const { errors } = useFormState({ control })
  const rows = useWatch({ control, name: 'axles' }) ?? []

  return (
    <div className="flex flex-col gap-3">
      <p className="text-small text-ink-3">{t('fleet.axles.usage')}</p>

      {fields.length === 0 ? (
        <p className="text-body text-text-3">{t('fleet.axles.empty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-150 border-collapse">
            <thead>
              <tr>
                <Th>{t('fleet.axles.name')}</Th>
                <Th>{t('fleet.axles.position')}</Th>
                {KG_COLUMNS.map(([column, heading]) => (
                  <Th key={column}>{t(`fleet.axles.${heading}`)}</Th>
                ))}
                <Th>
                  <span className="sr-only">{t('fleet.axles.add')}</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {fields.map((field, index) => {
                const rowError = errors.axles?.[index]
                return (
                  <tr key={field.rowKey} className="align-top">
                    <td className="px-2.5 py-2">
                      <Input
                        aria-label={`${t('fleet.axles.name')} ${index + 1}`}
                        className="w-48"
                        error={rowError?.name?.message}
                        {...register(`axles.${index}.name`)}
                      />
                    </td>
                    <td className="px-2.5 py-2">
                      <Input
                        aria-label={`${t('fleet.axles.position')} ${index + 1}`}
                        suffix="cm"
                        step={CM_STEP}
                        className="w-24"
                        error={rowError?.positionXCm?.message}
                        {...NUMERIC_FIELD_PROPS}
                        {...register(`axles.${index}.positionXCm`, { valueAsNumber: true })}
                      />
                    </td>
                    {KG_COLUMNS.map(([column, heading]) => (
                      <td key={column} className="px-2.5 py-2">
                        <Input
                          aria-label={`${t(`fleet.axles.${heading}`)} ${index + 1}`}
                          suffix="kg"
                          step={KG_STEP}
                          className="w-24"
                          error={rowError?.[column]?.message}
                          {...NUMERIC_FIELD_PROPS}
                          {...register(`axles.${index}.${column}`, { valueAsNumber: true })}
                        />
                      </td>
                    ))}
                    <td className="px-2.5 py-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={t('fleet.axles.remove', { row: index + 1 })}
                        onClick={() => remove(index)}
                      >
                        <Trash2 strokeWidth={1.5} />
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div>
        <Button type="button" variant="secondary" onClick={() => append(newAxle(rows))}>
          <Plus strokeWidth={1.5} />
          {t('fleet.axles.add')}
        </Button>
      </div>
    </div>
  )
}

function Th({ children }: { children: ReactNode }) {
  return <th className="px-2.5 pb-2 text-left text-caption font-medium text-text-3">{children}</th>
}
