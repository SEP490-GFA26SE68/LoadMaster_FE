import { zodResolver } from '@hookform/resolvers/zod'
import { ClipboardList } from 'lucide-react'
import { useMemo } from 'react'
import { Controller, useForm, useWatch, type Control } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Banner } from '@/components/Banner'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { SelectField } from '@/components/ui/SelectField'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/Textarea'
import type { Formatter } from '@/lib/format'
import { dataErrorMessage, useFormat, useT, type TFunction } from '@/lib/i18n'
import { REQUIREMENT_PRIORITIES, type DeliveryRequirement } from '@/lib/mock-db'
import type { RequirementRow } from './requirements-api'
import {
  initialValues, isFieldEditable, MAX_ADDRESS, MAX_NAME, MAX_NOTE, toChanges, toInput, validateRequirement, type RequirementFieldError, type RequirementFormValues,
} from './requirement-form'
import { packageWarnings, REQUIREMENT_PRIORITY_ORDER } from './requirement-list'
import type { RequirementPackage } from './requirements-api'
import { RequirementPackagePicker } from './RequirementPackagePicker'
import { useCreateRequirementMutation, useSelectablePackagesQuery, useUpdateRequirementMutation } from './useRequirementsQuery'

const MAX_OF: Partial<Record<keyof RequirementFormValues, number>> = { destinationName: MAX_NAME, address: MAX_ADDRESS, note: MAX_NOTE }

/** Câu lỗi của một ô: mã của `validateRequirement` → chữ. */
function errorText(field: keyof RequirementFormValues, code: RequirementFieldError, t: TFunction): string {
  if (code === 'tooLong') return t('requirements.form.errors.tooLong', { max: MAX_OF[field] ?? MAX_NOTE })
  if (code === 'deadlineInvalid' || code === 'deadlinePast' || code === 'packagesRequired') return t(`requirements.form.errors.${code}`)
  if (field === 'destinationName') return t('requirements.form.errors.destinationRequired')
  if (field === 'address') return t('requirements.form.errors.addressRequired')
  if (field === 'deadlineDate') return t('requirements.form.errors.deadlineDateRequired')
  if (field === 'deadlineTime') return t('requirements.form.errors.deadlineTimeRequired')
  return t('requirements.form.errors.priorityRequired')
}

/** Nêu tối đa sáu mã kiện; nhiều hơn thì nói còn bao nhiêu kiện nữa. */
const MAX_LISTED = 6

function otherDestinationText(ids: readonly string[], t: TFunction, format: Formatter): string {
  const listed = format.list(ids.slice(0, MAX_LISTED))
  return ids.length > MAX_LISTED
    ? t('requirements.form.warnings.otherDestinationMore', { count: ids.length, ids: listed, more: format.integer(ids.length - MAX_LISTED) })
    : t('requirements.form.warnings.otherDestination', { count: ids.length, ids: listed })
}

/** Schema zod của form: luật nằm ở `validateRequirement` (thuần, có test); schema chỉ gắn câu lỗi vào đúng ô. */
function requirementSchema(t: TFunction, original?: DeliveryRequirement) {
  return z
    .object({
      destinationName: z.string(), address: z.string(), deadlineDate: z.string(), deadlineTime: z.string(),
      priority: z.enum(REQUIREMENT_PRIORITIES), packageIds: z.array(z.string()), note: z.string(),
    })
    .superRefine((values, ctx) => {
      const errors = validateRequirement(values, new Date(), original)
      for (const field of Object.keys(errors) as (keyof RequirementFormValues)[]) {
        const code = errors[field]
        if (code) ctx.addIssue({ code: 'custom', path: [field], message: errorText(field, code, t) })
      }
    })
}

/**
 * Tạo / sửa yêu cầu giao (FE-4b-02) — của quản lý công ty. Trái: tên điểm đến, địa chỉ, hạn (ngày + giờ), ưu tiên, ghi chú; phải: chọn
 * kiện từ kho kiện (sửa thì kiện của chính yêu cầu vẫn nằm trong danh sách). Lỗi hiện tại ô. Hai cảnh báo không chặn lưu: kiện khác
 * loại hàng, điểm đến ghi trong file khác điểm đến của yêu cầu. Yêu cầu đã vào chuyến chỉ còn sửa hạn và ưu tiên: ô khác khoá, kèm một
 * dòng lý do. Kho từ chối (kiện vừa bị yêu cầu khác lấy…) thì câu lỗi hiện trong hộp thoại, không đóng. Toạ độ chưa nhập ở đây (ô
 * chọn toạ độ: FE-4b-03). Thân form gắn theo lúc mở nên mỗi lần mở là giá trị của yêu cầu đang sửa.
 */
export function RequirementFormDialog({ open, onOpenChange, row }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Vắng là tạo yêu cầu mới. */
  row?: RequirementRow
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-220">
        {open ? <RequirementForm row={row} onClose={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function RequirementForm({ row, onClose }: { row?: RequirementRow; onClose: () => void }) {
  const t = useT()
  const current = row?.requirement
  const selectable = useSelectablePackagesQuery()
  const create = useCreateRequirementMutation()
  const update = useUpdateRequirementMutation(current?.id ?? '')
  const mutation = current ? update : create
  const schema = useMemo(() => requirementSchema(t, current), [t, current])
  const form = useForm<RequirementFormValues>({ resolver: zodResolver(schema), defaultValues: initialValues(current) })
  const locked = current !== undefined && current.status !== 'PENDING'
  // Yêu cầu đã vào chuyến không đổi kiện được: chỉ liệt kê kiện của chính nó
  const packages = useMemo(
    () => [...(row?.packages ?? []), ...(locked ? [] : (selectable.data ?? []).filter((item) => !current?.packageIds.includes(item.package.id)))],
    [row, current, locked, selectable.data],
  )
  const { errors } = form.formState
  const editable = (field: Parameters<typeof isFieldEditable>[0]) => isFieldEditable(field, current?.status)
  const coordinates = current?.lat === undefined || current.lng === undefined ? null : `${current.lat.toFixed(4)}, ${current.lng.toFixed(4)}`

  function handleSubmit(values: RequirementFormValues) {
    const done = (saved: DeliveryRequirement) => {
      toast.success(current ? t('requirements.form.saved', { id: saved.id }) : t('requirements.form.created', { id: saved.id }))
      onClose()
    }
    if (current) update.mutate(toChanges(values, current), { onSuccess: done })
    else create.mutate(toInput(values), { onSuccess: done })
  }

  return (
    <form noValidate onSubmit={form.handleSubmit(handleSubmit)}>
      <DialogHeader
        icon={ClipboardList}
        title={current ? t('requirements.form.editTitle', { id: current.id }) : t('requirements.form.createTitle')}
        description={t('requirements.form.description')}
      />
      <div className="grid gap-5 px-7 py-5 md:grid-cols-2">
        {locked ? <Banner tone="info" className="md:col-span-2">{t('requirements.form.lockedNote')}</Banner> : null}
        <div className="flex flex-col gap-3.5">
          <Input label={t('requirements.form.destinationName')} required readOnly={!editable('destinationName')} error={errors.destinationName?.message} {...form.register('destinationName')} />
          <div className="flex flex-col gap-1.5">
            <Input label={t('requirements.form.address')} required readOnly={!editable('address')} error={errors.address?.message} {...form.register('address')} />
            {coordinates !== null && !locked ? <CoordinatesNote control={form.control} address={current?.address ?? ''} coordinates={coordinates} /> : null}
          </div>
          <div className="grid items-start gap-3.5 sm:grid-cols-[minmax(0,1fr)_132px]">
            <Input type="date" label={t('requirements.form.deadlineDate')} required error={errors.deadlineDate?.message} {...form.register('deadlineDate')} />
            <Input type="time" label={t('requirements.form.deadlineTime')} required error={errors.deadlineTime?.message} {...form.register('deadlineTime')} />
          </div>
          <SelectField
            control={form.control}
            name="priority"
            label={t('requirements.form.priority')}
            options={REQUIREMENT_PRIORITY_ORDER.map((value) => ({ value, label: t(`requirements.priority.${value}`) }))}
          />
          <Textarea label={t('requirements.form.note')} rows={3} readOnly={!editable('note')} error={errors.note?.message} {...form.register('note')} />
        </div>
        {selectable.isPending ? (
          <div className="grid place-items-center py-8"><Spinner /></div>
        ) : (
          <Controller
            control={form.control}
            name="packageIds"
            render={({ field, fieldState }) => (
              <RequirementPackagePicker packages={packages} value={field.value} onChange={field.onChange} error={fieldState.error?.message} disabled={!editable('packageIds')} />
            )}
          />
        )}
        <FormWarnings control={form.control} packages={packages} />
        {mutation.isError ? <p role="alert" className="text-caption text-danger md:col-span-2">{dataErrorMessage(mutation.error, t)}</p> : null}
      </div>
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onClose}>{t('requirements.form.cancel')}</Button>
        <Button type="submit" loading={mutation.isPending}>{current ? t('requirements.form.save') : t('requirements.form.create')}</Button>
      </DialogFooter>
    </form>
  )
}

/**
 * Hai cảnh báo không chặn lưu. Tách thành component riêng để chỉ nó theo dõi ô đang gõ (`useWatch`): thân form — và ô chọn kiện hàng
 * trăm dòng — không vẽ lại theo từng phím.
 */
function FormWarnings({ control, packages }: { control: Control<RequirementFormValues>; packages: readonly RequirementPackage[] }) {
  const t = useT()
  const format = useFormat()
  const [destinationName, address, packageIds] = useWatch({ control, name: ['destinationName', 'address', 'packageIds'] })
  const warnings = packageWarnings(packages, packageIds, { destinationName, address })
  if (warnings.mixedClasses.length === 0 && warnings.otherDestination.length === 0) return null
  return (
    <Banner tone="warning" className="md:col-span-2">
      <p className="font-semibold">{t('requirements.form.warnings.title')}</p>
      <ul className="mt-1 flex list-disc flex-col gap-0.5 pl-4.5 text-small">
        {warnings.mixedClasses.length > 0 ? (
          <li>{t('requirements.form.warnings.mixedClasses', { classes: format.list(warnings.mixedClasses.map((value) => t(`common.handlingClasses.${value}`))) })}</li>
        ) : null}
        {warnings.otherDestination.length > 0 ? <li>{otherDestinationText(warnings.otherDestination, t, format)}</li> : null}
      </ul>
    </Banner>
  )
}

/** Gợi ý dưới ô địa chỉ khi đang sửa: đổi địa chỉ thì toạ độ đang có (của địa chỉ cũ) sẽ bị bỏ. */
function CoordinatesNote({ control, address, coordinates }: { control: Control<RequirementFormValues>; address: string; coordinates: string }) {
  const t = useT()
  const typed = useWatch({ control, name: 'address' })
  return typed.trim() === address ? null : <p role="note" className="text-fine text-warning">{t('requirements.form.coordinatesReset', { coordinates })}</p>
}
