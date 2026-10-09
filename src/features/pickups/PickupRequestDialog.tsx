import { zodResolver } from '@hookform/resolvers/zod'
import { CircleCheck, PackagePlus, Plus, X } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Controller, useFieldArray, useForm, type FieldErrors } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Banner } from '@/components/Banner'
import { CoordinatePicker, placeAddress } from '@/components/map'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { fieldBoxClass, focusClass, FieldLabel } from '@/components/ui/field-styles'
import { Input } from '@/components/ui/Input'
import { HANDLING_CLASSES } from '@/domain/models'
import { dataErrorMessage, useT, type TFunction } from '@/lib/i18n'
import type { PickupRequest } from '@/lib/mock-db'
import { cn } from '@/lib/utils'
import { PickupRulesList } from './PickupRulesList'
import {
  emptyPackage, initialPickupValues, MAX_ADDRESS, MAX_CODE, MAX_NAME, toPickupInput, validatePickupForm, type PickupFormValues,
} from './pickup-form'
import { stopLabeler, type StopRef } from './pickup-stops'
import { useCreatePickupMutation } from './usePickupsQuery'

const pointSchema = z.object({ name: z.string(), address: z.string(), coordinates: z.object({ lat: z.string(), lng: z.string() }) })

/** Schema zod: luật nằm ở `validatePickupForm` (thuần, có test); schema chỉ gắn **mã** lỗi vào đúng ô, component dịch. */
const schema = z
  .object({
    pickup: pointSchema,
    delivery: pointSchema,
    deadlineDate: z.string(),
    deadlineTime: z.string(),
    packages: z.array(z.object({
      packageCode: z.string(), lengthCm: z.string(), widthCm: z.string(), heightCm: z.string(), weightKg: z.string(), handlingClass: z.enum(HANDLING_CLASSES),
    })),
  })
  .superRefine((values, ctx) => {
    for (const issue of validatePickupForm(values)) ctx.addIssue({ code: 'custom', path: issue.path, message: issue.code })
  })

function errorText(code: string | undefined, max: number, t: TFunction): string | undefined {
  switch (code) {
    case 'required': return t('pickups.dialog.errors.required')
    case 'tooLong': return t('pickups.dialog.errors.tooLong', { max })
    case 'coordinatesRequired': return t('pickups.dialog.errors.coordinatesRequired')
    case 'coordinatesInvalid': return t('pickups.dialog.errors.coordinatesInvalid')
    case 'deadlineInvalid': return t('pickups.dialog.errors.deadlineInvalid')
    case 'number': return t('pickups.dialog.errors.number')
    case 'packagesRequired': return t('pickups.dialog.errors.packagesRequired')
    default: return undefined
  }
}

const SIZE_COLUMNS = [
  ['lengthCm', 'length'], ['widthCm', 'width'], ['heightCm', 'height'], ['weightKg', 'weight'],
] as const

/**
 * Hộp "Nhận hàng dọc đường" (FE-7-03, D-88): điểm nhận, điểm giao (ô chọn toạ độ dùng chung), hạn tuỳ chọn và danh sách kiện nhận (mã
 * của bên gửi, kích thước cm, khối lượng kg, loại hàng). Lưu xong kho kiểm mười luật ngay; hộp chuyển sang kết quả Đạt / Không đạt
 * (`PickupRulesList`) thay vì đóng. Điều phối viên mở từ Chi tiết chuyến và Giám sát; tài xế mở từ màn điểm giao (`touch`: ô và nút 56 px,
 * chữ 16 px). Dưới 768 px là tờ trượt từ đáy (`DialogContent sheet`): thân cuộn cùng tờ, chân hộp dính đáy; từ 768 px là hộp giữa màn.
 * Thân form dựng lại mỗi lần mở.
 */
export function PickupRequestDialog({ tripId, stops, open, onOpenChange, touch = false }: {
  tripId: string
  /** Điểm của chuyến, để luật 2 gọi tên điểm được bảo vệ. */
  stops: readonly StopRef[]
  open: boolean
  onOpenChange: (open: boolean) => void
  touch?: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <DialogContent sheet className="w-[min(60rem,calc(100vw-3rem))]">
          <PickupForm tripId={tripId} stops={stops} touch={touch} onClose={() => onOpenChange(false)} />
        </DialogContent>
      ) : null}
    </Dialog>
  )
}

function PickupForm({ tripId, stops, touch, onClose }: { tripId: string; stops: readonly StopRef[]; touch: boolean; onClose: () => void }) {
  const t = useT()
  const create = useCreatePickupMutation(tripId)
  const [created, setCreated] = useState<PickupRequest | null>(null)
  const form = useForm<PickupFormValues>({ resolver: zodResolver(schema), defaultValues: initialPickupValues() })
  const fields = useFieldArray({ control: form.control, name: 'packages' })
  const stopLabel = useMemo(() => stopLabeler(stops, t), [stops, t])
  const size = touch ? 'touch' : 'md'
  const inputClass = touch ? 'h-14 text-body-lg' : undefined

  if (created) return <PickupResult request={created} stopLabel={stopLabel} touch={touch} onClose={onClose} />

  function handleSubmit(values: PickupFormValues) {
    create.mutate(toPickupInput(values), {
      onSuccess: (request) => {
        // Màn cảm ứng của tài xế: bước kết quả ngay trong hộp đã nói yêu cầu vừa gửi, không thêm toast phủ lên tờ trượt
        if (!touch) toast.success(t('pickups.result.sent', { id: request.id }))
        setCreated(request)
      },
    })
  }

  return (
    <form noValidate className={touch ? 'text-body-lg' : undefined} onSubmit={form.handleSubmit(handleSubmit)}>
      <DialogHeader icon={PackagePlus} title={t('pickups.dialog.title', { id: tripId })} description={t('pickups.dialog.description')} />
      <div className="flex flex-col gap-5 px-7 py-5 max-sm:px-4 md:max-h-[calc(100dvh-14rem)] md:overflow-y-auto">
        <div className="grid gap-5 md:grid-cols-2">
          <PointFields prefix="pickup" form={form} touch={touch} />
          <PointFields prefix="delivery" form={form} touch={touch} />
        </div>
        <div className="grid items-start gap-3.5 sm:grid-cols-[minmax(0,1fr)_132px]">
          <Input
            type="date" label={t('pickups.dialog.deadlineDate')} hint={t('pickups.dialog.deadlineHint')} className={inputClass}
            error={errorText(form.formState.errors.deadlineDate?.message, 0, t)} {...form.register('deadlineDate')}
          />
          <Input type="time" label={t('pickups.dialog.deadlineTime')} className={inputClass} {...form.register('deadlineTime')} />
        </div>

        <fieldset className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0">
          <legend className={cn('mb-1 p-0 font-display font-[650] text-ink-strong', touch ? 'text-h3' : 'text-body')}>{t('pickups.dialog.packages.title')}</legend>
          {fields.fields.map((field, index) => (
            <PackageRow
              key={field.id}
              index={index}
              form={form}
              touch={touch}
              removable={fields.fields.length > 1}
              onRemove={() => fields.remove(index)}
            />
          ))}
          <Button type="button" variant="secondary" size={size} className="self-start" onClick={() => fields.append(emptyPackage())}>
            <Plus strokeWidth={1.75} />
            {t('pickups.dialog.packages.add')}
          </Button>
        </fieldset>
        {create.isError ? <p role="alert" className="m-0 text-caption text-danger">{dataErrorMessage(create.error, t)}</p> : null}
      </div>
      <DialogFooter className="sticky bottom-0">
        <DialogClose asChild><Button type="button" variant="secondary" size={size}>{t('pickups.dialog.cancel')}</Button></DialogClose>
        <Button type="submit" size={size} loading={create.isPending}>{t('pickups.dialog.submit')}</Button>
      </DialogFooter>
    </form>
  )
}

function PointFields({ prefix, form, touch }: { prefix: 'pickup' | 'delivery'; form: ReturnType<typeof useForm<PickupFormValues>>; touch: boolean }) {
  const t = useT()
  const errors = form.formState.errors[prefix]
  const inputClass = touch ? 'h-14 text-body-lg' : undefined
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-3.5 border-0 p-0">
      <legend className={cn('mb-1 p-0 font-display font-[650] text-ink-strong', touch ? 'text-h3' : 'text-body')}>{t(`pickups.dialog.${prefix}Point`)}</legend>
      <Input label={t('pickups.dialog.name')} required className={inputClass} error={errorText(errors?.name?.message, MAX_NAME, t)} {...form.register(`${prefix}.name`)} />
      <Input label={t('pickups.dialog.address')} required className={inputClass} error={errorText(errors?.address?.message, MAX_ADDRESS, t)} {...form.register(`${prefix}.address`)} />
      <Controller
        control={form.control}
        name={`${prefix}.coordinates`}
        render={({ field }) => (
          <CoordinatePicker
            label={t('pickups.dialog.coordinates')}
            value={field.value}
            onChange={field.onChange}
            showErrors={form.formState.isSubmitted}
            onPlacePicked={(place) => {
              if (form.getValues(`${prefix}.address`).trim() === '') form.setValue(`${prefix}.address`, placeAddress(place), { shouldDirty: true, shouldValidate: form.formState.isSubmitted })
              if (form.getValues(`${prefix}.name`).trim() === '') form.setValue(`${prefix}.name`, place.name, { shouldDirty: true, shouldValidate: form.formState.isSubmitted })
            }}
          />
        )}
      />
      {errors?.coordinates?.message ? <p role="alert" className="m-0 text-fine text-danger">{errorText(errors.coordinates.message, 0, t)}</p> : null}
    </fieldset>
  )
}

function packageErrors(errors: FieldErrors<PickupFormValues>, index: number) {
  return Array.isArray(errors.packages) ? errors.packages[index] : undefined
}

function PackageRow({ index, form, touch, removable, onRemove }: {
  index: number
  form: ReturnType<typeof useForm<PickupFormValues>>
  touch: boolean
  removable: boolean
  onRemove: () => void
}) {
  const t = useT()
  const classId = useId()
  const errors = packageErrors(form.formState.errors, index)
  const inputClass = touch ? 'h-14 text-body-lg' : undefined
  return (
    <div role="group" aria-label={t('pickups.dialog.packages.row', { number: index + 1 })} className="flex flex-col gap-3 rounded-md border border-border bg-surface p-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className={cn('font-semibold text-ink-2', touch ? 'text-body-lg' : 'text-small')}>{t('pickups.dialog.packages.row', { number: index + 1 })}</span>
        {removable ? (
          <Button type="button" variant="ghost" size={touch ? 'touch' : 'sm'} aria-label={t('pickups.dialog.packages.remove', { number: index + 1 })} onClick={onRemove}>
            <X strokeWidth={1.75} />
          </Button>
        ) : null}
      </div>
      <div className="grid items-start gap-3 sm:grid-cols-[minmax(0,1.3fr)_repeat(4,minmax(0,1fr))_minmax(0,1.2fr)]">
        <Input
          label={t('pickups.dialog.packages.code')} required className={inputClass}
          error={errorText(errors?.packageCode?.message, MAX_CODE, t)} {...form.register(`packages.${index}.packageCode`)}
        />
        {SIZE_COLUMNS.map(([field, key]) => (
          <Input
            key={field} label={t(`pickups.dialog.packages.${key}`)} required numeric inputMode="decimal" className={inputClass}
            error={errorText(errors?.[field]?.message, 0, t)} {...form.register(`packages.${index}.${field}`)}
          />
        ))}
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor={`${classId}-${index}`}>{t('pickups.dialog.packages.handlingClass')}</FieldLabel>
          <select id={`${classId}-${index}`} className={cn(fieldBoxClass(false), focusClass, 'h-10 w-full min-w-0 px-3', touch && 'h-14 text-body-lg')} {...form.register(`packages.${index}.handlingClass`)}>
            {HANDLING_CLASSES.map((value) => <option key={value} value={value}>{t(`common.handlingClasses.${value}`)}</option>)}
          </select>
        </div>
      </div>
    </div>
  )
}

/** Kết quả của lần kiểm mười luật ngay sau khi lưu. */
function PickupResult({ request, stopLabel, touch, onClose }: { request: PickupRequest; stopLabel: (stopId: string) => string; touch: boolean; onClose: () => void }) {
  const t = useT()
  const failed = request.validationResults.filter((result) => !result.passed).length
  const rootRef = useRef<HTMLDivElement>(null)
  // Tờ trượt dùng lại khung cuộn của form: bước kết quả bắt đầu từ đầu, không giữ chỗ cuộn của form
  useEffect(() => {
    if (rootRef.current?.parentElement) rootRef.current.parentElement.scrollTop = 0
  }, [])
  return (
    <div ref={rootRef} className={touch ? 'text-body-lg' : undefined}>
      <DialogHeader icon={CircleCheck} tone="success" title={t('pickups.result.title', { id: request.id })} description={t(`pickups.status.${request.status}`)} />
      <div className="flex flex-col gap-3 px-7 py-5 max-sm:px-4 md:max-h-[calc(100dvh-14rem)] md:overflow-y-auto">
        <Banner tone={failed === 0 ? 'info' : 'warning'}>{failed === 0 ? t('pickups.result.validated') : t('pickups.result.pending', { count: failed })}</Banner>
        <PickupRulesList results={request.validationResults} stopLabel={stopLabel} touch={touch} />
      </div>
      <DialogFooter className="sticky bottom-0">
        <Button type="button" size={touch ? 'touch' : 'md'} onClick={onClose}>{t('pickups.dialog.close')}</Button>
      </DialogFooter>
    </div>
  )
}
