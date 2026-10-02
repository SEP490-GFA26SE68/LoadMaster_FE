import { Controller, type UseFormReturn } from 'react-hook-form'
import { CoordinatePicker, placeAddress } from '@/components/map'
import { FieldMessage } from '@/components/ui/field-styles'
import { Input } from '@/components/ui/Input'
import { useT } from '@/lib/i18n'
import type { TripFormValues } from './trip-form.schema'
import { FieldMark, TripFormSection } from './TripFormSection'

/**
 * Mục 2 của form chuyến (FE-4b-04, D-76): kho xuất phát — tên, địa chỉ và toạ độ qua ô chọn toạ độ dùng chung (FE-4b-03). Mặc định là
 * kho của công ty; đổi khi chuyến đi từ bãi khác. Toạ độ bắt buộc: kho là điểm đầu của tuyến. Kho đã bắt đầu xếp thì kho đi khoá cùng
 * xe và điểm giao (D-45). Chọn một địa danh khi ô địa chỉ còn trống thì địa chỉ được điền theo địa danh.
 */
export function TripFormDepotSection({ form, locked }: { form: UseFormReturn<TripFormValues>; locked: boolean }) {
  const t = useT()
  const errors = form.formState.errors.depot
  return (
    <TripFormSection number={2} title={t('trips.create.depotTitle')} locked={locked} description={locked ? undefined : t('trips.create.depotHint')}>
      <fieldset disabled={locked} className="m-0 grid min-w-0 grid-cols-1 items-start gap-4 border-0 p-0 md:grid-cols-12">
        <div className="md:col-span-5">
          <Input
            label={<>{t('trips.create.depotName')}<FieldMark kind="required" /></>}
            aria-label={t('trips.create.depotName')}
            aria-required
            error={errors?.name?.message}
            {...form.register('depot.name')}
          />
        </div>
        <div className="md:col-span-7">
          <Input label={t('trips.create.depotAddress')} aria-label={t('trips.create.depotAddress')} error={errors?.address?.message} {...form.register('depot.address')} />
        </div>
        <div className="flex flex-col gap-1.5 md:col-span-12">
          <Controller
            control={form.control}
            name="depot.coordinates"
            render={({ field, fieldState }) => (
              <>
                <CoordinatePicker
                  label={t('trips.create.depotCoordinates')}
                  value={field.value}
                  onChange={(next) => { field.onChange(next); field.onBlur() }}
                  disabled={locked}
                  showErrors={form.formState.isSubmitted}
                  onPlacePicked={(place) => {
                    if (form.getValues('depot.address').trim() === '') form.setValue('depot.address', placeAddress(place), { shouldDirty: true })
                  }}
                />
                {/* Hai ô đều trống: không ô nào sai, lỗi "chưa chọn toạ độ" nằm ở cả nhóm */}
                {fieldState.error && field.value.lat === '' && field.value.lng === '' ? <FieldMessage error={fieldState.error.message} /> : null}
              </>
            )}
          />
        </div>
      </fieldset>
    </TripFormSection>
  )
}
