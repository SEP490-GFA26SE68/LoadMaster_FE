import { zodResolver } from '@hookform/resolvers/zod'
import { Copy, Save, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useParams } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { checkDoorClearance } from '@/domain/constraints'
import { isUpright } from '@/domain/geometry'
import { cargoPackageSchema, type CargoPackage, type VehicleConfig } from '@/domain/models'
import { formatIssue, useFormat, useT } from '@/lib/i18n'
import { PackageDeleteDialog } from './PackageDeleteDialog'
import { PackageFormFields } from './PackageFormFields'
import { PackagePanelHeader } from './PackagePanelHeader'
import { PackagePreview } from './PackagePreview'
import { PackageStaleNotice } from './PackageStaleNotice'
import type { StopRow } from './trip-summary'

/**
 * Panel một kiện (LM-045, V2.3 `ChiTietChuyenKien`). Desktop: card cột phải, thân cuộn, chân nút dính; tablet/điện thoại: tấm dưới,
 * nút 56 px. Đầu panel là hình + số của kiện (theo giá trị đang nhập), rồi cảnh báo lỗi thời (D-31), rồi form.
 * Tự đồng bộ theo D-25 — `keepUpright` bỏ các hướng nằm nghiêng và khoá ô, `stackable` tắt đưa tải trên về 0 —
 * còn `cargoPackageSchema` là nơi từ chối dữ liệu xung đột. Lỗi cửa (`DOOR_TOO_SMALL`) hiện ngay theo xe của chuyến.
 */
export function PackageFormPanel({ value, vehicle, stops, onSave, onDelete, onDuplicate, onClose, readOnly = false, tripId }: {
  value: CargoPackage
  vehicle: VehicleConfig
  stops: readonly StopRow[]
  onSave: (pkg: CargoPackage, keepOpen: boolean) => void
  onDelete?: (pkg: CargoPackage) => void
  onDuplicate?: (pkg: CargoPackage) => void
  onClose: () => void
  /** Xem không sửa: người không có quyền sửa chuyến, hoặc chuyến đã khoá (D-41, D-45). */
  readOnly?: boolean
  /** Chuyến của kiện, để cảnh báo revision sẽ lỗi thời khi lưu. Vắng thì lấy `:tripId` của route; ngoài route thì không cảnh báo. */
  tripId?: string
}) {
  const t = useT()
  const format = useFormat()
  const params = useParams()
  const staleTripId = tripId ?? params.tripId
  const [removedOrientations, setRemovedOrientations] = useState(0)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const form = useForm<CargoPackage>({ resolver: zodResolver(cargoPackageSchema), values: value, mode: 'onChange' })
  const { control, setValue, handleSubmit } = form

  const draft = useWatch({ control })

  /** D-25: bật giữ thẳng đứng bỏ ngay các hướng nằm nghiêng đang chọn và cho biết đã bỏ mấy hướng. */
  function handleKeepUpright(checked: boolean) {
    setValue('keepUpright', checked, { shouldValidate: true, shouldDirty: true })
    if (!checked) { setRemovedOrientations(0); return }
    const current = form.getValues('allowedOrientations')
    const upright = current.filter(isUpright)
    setValue('allowedOrientations', upright, { shouldValidate: true, shouldDirty: true })
    setRemovedOrientations(current.length - upright.length)
  }

  /** D-25: kiện không cho xếp chồng thì tải trên bằng 0 — schema từ chối số khác 0. */
  function handleStackable(checked: boolean) {
    setValue('stackable', checked, { shouldValidate: true, shouldDirty: true })
    if (!checked) setValue('maxTopLoadKg', 0, { shouldValidate: true, shouldDirty: true })
  }

  const parsed = cargoPackageSchema.safeParse(draft)
  const doorIssues = parsed.success ? checkDoorClearance(parsed.data, vehicle) : []
  // Đầu panel theo giá trị đang nhập khi hợp lệ: hình và tổng khối lượng đổi cùng form
  const shown = parsed.success ? parsed.data : value
  const isNew = value.name === '' && value.lengthCm === 0
  const title = isNew ? t('trips.form.titleNew') : t('trips.form.title', { id: value.id })

  function handleDelete() {
    setConfirmDelete(false)
    onDelete?.(value)
    toast.success(t('trips.form.deleted', { id: value.id }))
  }

  return (
    <aside
      aria-label={title}
      className="flex w-full flex-col overflow-hidden border-border bg-bg max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-20 max-md:max-h-[70dvh] max-md:rounded-t-xl max-md:border-t max-md:shadow-e3 md:rounded-lg md:border md:shadow-card xl:sticky xl:top-0 xl:max-h-[calc(100dvh-8rem)]"
    >
      <PackagePanelHeader pkg={shown} stop={stops[shown.deliveryStop - 1]} title={title} onClose={onClose} />

      <form
        className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-4.5 pt-3.5 pb-4.5"
        onSubmit={handleSubmit((values) => onSave(values, false))}
        id="package-form"
      >
        {!readOnly && staleTripId ? <PackageStaleNotice tripId={staleTripId} /> : null}

        {removedOrientations > 0 ? (
          <p role="status" className="rounded-md bg-badge-warning-bg px-3 py-2 text-fine text-badge-warning-fg">
            {t('trips.form.keepUprightApplied', { count: removedOrientations })}
          </p>
        ) : null}

        {doorIssues.map((issue) => (
          <p key={issue.code} role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-fine text-red-700">
            {formatIssue(issue, t, format)}
          </p>
        ))}

        {/* Người chỉ xem (quản lý, chuyến đã khoá) thấy phần xem kiện thay cho form */}
        {readOnly ? <PackagePreview pkg={value} /> : (
          <fieldset className="m-0 flex min-w-0 flex-col border-0 p-0">
            <PackageFormFields form={form} stops={stops} onKeepUprightChange={handleKeepUpright} onStackableChange={handleStackable} />
          </fieldset>
        )}
      </form>

      {readOnly ? null : (
        <div className="flex flex-none flex-col gap-2 border-t border-border bg-bg px-4.5 pt-3 pb-3.5">
          <div className="flex gap-2">
            <Button type="submit" form="package-form" variant="primary" className="h-14 flex-1 md:h-10">
              <Save strokeWidth={1.75} />{t('trips.form.save')}
            </Button>
            <Button type="button" variant="secondary" className="h-14 md:h-10" onClick={handleSubmit((values) => onSave(values, true))}>
              {t('trips.form.saveAndNew')}
            </Button>
          </div>
          {onDuplicate || onDelete ? (
            <div className="flex justify-between gap-2">
              {onDuplicate ? (
                <Button type="button" variant="ghost" size="sm" className="h-12 text-ink-2 md:h-8" onClick={() => onDuplicate(value)}>
                  <Copy strokeWidth={1.75} />{t('trips.form.duplicate')}
                </Button>
              ) : <span />}
              {onDelete ? (
                // V2.3 `.btn-danger-soft`: nền trắng, viền và chữ đỏ — nút đỏ đặc để dành cho hộp thoại xác nhận
                <Button type="button" variant="secondary" size="sm" className="h-12 border-red-200 text-red-700 hover:bg-red-50 md:h-8"
                  onClick={() => setConfirmDelete(true)}>
                  <Trash2 strokeWidth={1.75} />{t('trips.form.delete')}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      )}

      <PackageDeleteDialog open={confirmDelete} onOpenChange={setConfirmDelete} packageId={value.id} onConfirm={handleDelete} />
    </aside>
  )
}
