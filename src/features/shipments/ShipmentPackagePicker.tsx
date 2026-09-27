import { Checkbox } from '@/components/ui/Checkbox'
import { FieldMessage, fieldLabelClass } from '@/components/ui/field-styles'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { PackageGroup } from './shipment-form'

/**
 * Chọn kiện cho lô (LM-104): kiện nhóm theo loại, mỗi nhóm có ô chọn cả nhóm, từng kiện là một ô chọn có mã mono. Giá trị do form
 * giữ (`packageIds`), ô này chỉ trình bày và báo thay đổi.
 */
export function ShipmentPackagePicker({ groups, value, onChange, error }: {
  groups: readonly PackageGroup[]
  value: readonly string[]
  onChange: (ids: string[]) => void
  error?: string
}) {
  const t = useT()
  const chosen = new Set(value)

  function setMany(ids: readonly string[], checked: boolean) {
    const next = new Set(chosen)
    for (const id of ids) {
      if (checked) next.add(id)
      else next.delete(id)
    }
    // Giữ thứ tự của danh sách để lô liệt kê kiện theo nhóm
    onChange(groups.flatMap((group) => group.packages.map((pkg) => pkg.id)).filter((id) => next.has(id)))
  }

  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
      <legend className="mb-1 flex w-full items-baseline justify-between gap-3 p-0">
        <span className={fieldLabelClass}>{t('sourcing.shipments.form.packages')}<span aria-hidden className="text-danger"> *</span></span>
        <span className="text-small text-ink-2 tabular-nums">{t('sourcing.shipments.form.selected', { count: chosen.size })}</span>
      </legend>
      {groups.length === 0 ? (
        <p className="rounded-md border border-border bg-n-25 px-3 py-4 text-body text-ink-2">{t('sourcing.shipments.form.noPackages')}</p>
      ) : (
        <div className={cn('max-h-72 overflow-y-auto rounded-md border', error ? 'border-red-500' : 'border-line-strong')}>
          {groups.map((group) => {
            const ids = group.packages.map((pkg) => pkg.id)
            const all = ids.every((id) => chosen.has(id))
            const name = group.type?.name ?? group.typeId
            return (
              <div key={group.typeId} className="flex flex-col gap-2 border-b border-line-soft px-3 py-2.5 last:border-b-0">
                <Checkbox
                  aria-label={t('sourcing.shipments.form.selectType', { name })}
                  checked={all}
                  onCheckedChange={(checked) => setMany(ids, checked === true)}
                  label={<span className="font-medium text-ink-strong">{name} <span className="font-mono text-caption text-ink-3">{group.typeId} · {ids.length}</span></span>}
                />
                <div className="flex flex-wrap gap-x-4 gap-y-2 pl-7">
                  {group.packages.map((pkg) => (
                    <Checkbox
                      key={pkg.id}
                      checked={chosen.has(pkg.id)}
                      onCheckedChange={(checked) => setMany([pkg.id], checked === true)}
                      label={<span className="font-mono text-small">{pkg.id}</span>}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
      <FieldMessage error={error} hint={t('sourcing.shipments.form.packagesHint')} />
    </fieldset>
  )
}
