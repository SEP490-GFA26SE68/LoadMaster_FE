import { Save, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useForm, useWatch, type FieldPath } from 'react-hook-form'
import { useBlocker, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { PageHero } from '@/components/PageHero'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import type { VehicleConfig } from '@/domain/models'
import { useFormat, useT } from '@/lib/i18n'
import { MockDbError } from '@/lib/mock-db'
import { AxleTable } from './AxleTable'
import { ObstacleTable } from './ObstacleTable'
import { useDeleteVehicleMutation, useSaveVehicleMutation } from './useVehiclesQuery'
import { createVehicleFormSchema, toFormValues, toVehicleConfig, type VehicleFormValues } from './vehicle-form'
import { createVehicleResolver, flattenFormErrors } from './vehicle-form-resolver'
import { VehiclePreview } from './VehiclePreview'
import { VehicleFormSection } from './VehicleFormSection'
import { VehicleSpecFields } from './VehicleSpecFields'
import { VehicleValidationSummary } from './VehicleValidationSummary'

const FLEET_PATH = '/doi-xe'

/** Lỗi gắn cả dòng vật cản không có ô riêng để nhận focus — đưa con trỏ về ô đầu của dòng. */
function focusTarget(path: string): FieldPath<VehicleFormValues> {
  return (/^obstacles\.\d+$/.test(path) ? `${path}.xCm` : path) as FieldPath<VehicleFormValues>
}

/**
 * Form cấu hình xe (Spec 9.2, LM-041) dùng cho cả `/doi-xe/moi` và `/doi-xe/:vehicleId`.
 * `vehicle` vắng nghĩa là thêm xe mới; khi đó `id` rỗng và kho cấp mã lúc lưu. `readOnly`: người không có quyền sửa đội xe
 * (quản lý, D-41) hoặc xe đang chạy chuyến (LM-089) — xem cấu hình nhưng không có nút Lưu/Xoá và ô nhập bị khoá.
 * Ba chỗ trống cho trạng thái xe (LM-089): `status` là chip cạnh tên, `actions` trước nút Xoá, `notice` đầu thẻ form.
 */
export function VehicleForm({ vehicle, readOnly = false, status, actions, notice }: {
  vehicle?: VehicleConfig
  readOnly?: boolean
  status?: ReactNode
  actions?: ReactNode
  notice?: ReactNode
}) {
  const t = useT()
  const format = useFormat()
  const navigate = useNavigate()
  const save = useSaveVehicleMutation()
  const remove = useDeleteVehicleMutation()
  const [confirmDelete, setConfirmDelete] = useState(false)
  // Vật cản đang làm nổi, chung cho bảng và xem trước 3D (LM-042)
  const [highlightedObstacle, setHighlightedObstacle] = useState<string | null>(null)
  // Lưu hoặc xoá xong: rời trang trong effect ở lần render sau, để hộp hỏi "rời trang?" không chặn chính mình
  const [done, setDone] = useState(false)

  const resolver = useMemo(() => createVehicleResolver(createVehicleFormSchema(t), t, format), [t, format])
  const form = useForm<VehicleFormValues>({
    resolver,
    defaultValues: toFormValues(vehicle),
  })
  const { errors, isDirty } = form.formState
  const issues = flattenFormErrors(errors)
  const obstacleCount = useWatch({ control: form.control, name: 'obstacles' })?.length ?? 0

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && !done && currentLocation.pathname !== nextLocation.pathname,
  )

  useEffect(() => {
    if (done) void navigate(FLEET_PATH)
  }, [done, navigate])

  function handleSave(values: VehicleFormValues) {
    save.mutate(toVehicleConfig(values, vehicle), {
      onSuccess: (saved) => {
        toast.success(t(vehicle ? 'fleet.detail.saved' : 'fleet.detail.created', { name: saved.name }))
        setDone(true)
      },
      onError: () => toast.error(t('fleet.detail.saveFailed')),
    })
  }

  function handleDelete() {
    if (!vehicle) return
    remove.mutate(vehicle.id, {
      onSuccess: () => {
        setConfirmDelete(false)
        toast.success(t('fleet.detail.deleted', { name: vehicle.name }))
        setDone(true)
      },
      onError: (error) => {
        setConfirmDelete(false)
        toast.error(
          error instanceof MockDbError && error.code === 'VEHICLE_IN_USE'
            ? t('fleet.detail.inUse', { trips: format.list(error.params.tripIds) })
            : t('fleet.detail.deleteFailed'),
        )
      },
    })
  }

  return (
    <form noValidate onSubmit={form.handleSubmit(handleSave)} className="flex min-w-0 flex-1 flex-col">
      {/* V2.3 (ChiTietXe.jpg, ThemXe.jpg): tiêu đề là dữ liệu (tên xe) trên dải trời; Lưu là nút chính duy nhất, nằm trong form nên là nút submit */}
      <PageHero
        overlap
        back={{ to: FLEET_PATH, label: t('fleet.detail.back') }}
        title={vehicle ? vehicle.name : t('fleet.detail.newTitle')}
        crumbs={[
          { label: t('fleet.title'), to: FLEET_PATH },
          vehicle ? { label: vehicle.id, mono: true } : { label: t('fleet.detail.newTitle') },
        ]}
        badge={status}
        description={vehicle ? (
          t('fleet.detail.facts', {
            inner: format.dimensions(vehicle.innerLengthCm, vehicle.innerWidthCm, vehicle.innerHeightCm),
            payload: format.weight(vehicle.maxPayloadKg),
            door: format.widthByHeight(vehicle.doorWidthCm, vehicle.doorHeightCm),
          })
        ) : t('fleet.detail.newDescription')}
        actions={
          <>
            {actions}
            {vehicle && !readOnly ? (
              <Button type="button" variant="glass" onClick={() => setConfirmDelete(true)}>
                <Trash2 strokeWidth={1.5} />
                {t('fleet.detail.delete')}
              </Button>
            ) : null}
            {readOnly ? null : (
              <Button type="submit" variant="primary" loading={save.isPending}>
                <Save strokeWidth={1.5} />
                {t('fleet.detail.save')}
              </Button>
            )}
          </>
        }
      />

      <div className="sky-overlap min-h-0 flex-1 overflow-auto px-shell pb-6">
        {/* Màn rộng: xem trước 3D là cột phải dính khi cuộn; màn hẹp: nằm cuối form (LM-042) */}
        <div className="grid max-w-400 grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
          <Card className="flex min-w-0 flex-col rounded-lg">
            {notice || issues.length > 0 ? (
              <div className="flex flex-col gap-3 border-b border-line-soft p-5">
                {notice}
                <VehicleValidationSummary issues={issues} onFocus={(path) => form.setFocus(focusTarget(path))} />
              </div>
            ) : null}

            <fieldset disabled={readOnly} className="m-0 flex min-w-0 flex-col border-0 p-0">
              <VehicleFormSection number={1} title={t('fleet.detail.specTitle')} meta={t('fleet.detail.specHint')}>
                <VehicleSpecFields control={form.control} register={form.register} />
              </VehicleFormSection>

              <VehicleFormSection
                number={2}
                title={t('fleet.detail.obstaclesTitle')}
                meta={t('fleet.detail.obstaclesCount', { count: obstacleCount })}
              >
                <ObstacleTable
                  control={form.control}
                  register={form.register}
                  setValue={form.setValue}
                  highlightedId={highlightedObstacle}
                  onHighlight={setHighlightedObstacle}
                />
              </VehicleFormSection>

              <VehicleFormSection number={3} title={t('fleet.detail.axlesTitle')} meta={t('fleet.detail.axlesHint')}>
                <AxleTable control={form.control} register={form.register} />
              </VehicleFormSection>
            </fieldset>
          </Card>

          {/* Thẻ tối đặc quanh khung 3D vốn đã tối (không kính mới): tiêu đề, chú thích và hình cùng một nền */}
          <aside className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-border-dark bg-panel-dark text-glass-dark-text shadow-card xl:sticky xl:top-0">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-border-dark px-5 py-3.5">
              <h2 className="font-display text-h3 leading-5.5 font-[650] font-stretch-106%">{t('fleet.preview.title')}</h2>
              <span className="text-small text-glass-dark-muted">{t('fleet.preview.caption')}</span>
            </div>
            <div className="p-4">
              <VehiclePreview
                control={form.control}
                highlightedObstacleId={highlightedObstacle}
                onHighlightObstacle={setHighlightedObstacle}
              />
            </div>
          </aside>
        </div>
      </div>

      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => {
          if (!open) blocker.reset?.()
        }}
        title={t('fleet.leave.title')}
        description={t('fleet.leave.description')}
        cancelLabel={t('fleet.leave.stay')}
        confirmLabel={t('fleet.leave.confirm')}
        danger
        onConfirm={() => blocker.proceed?.()}
      />

      {vehicle ? (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title={t('fleet.remove.title', { name: vehicle.name })}
          description={t('fleet.remove.description')}
          cancelLabel={t('fleet.remove.cancel')}
          confirmLabel={t('fleet.remove.confirm')}
          danger
          pending={remove.isPending}
          onConfirm={handleDelete}
        />
      ) : null}
    </form>
  )
}
