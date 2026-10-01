import { useId } from 'react'
import { Checkbox } from '@/components/ui/Checkbox'
import { useFormat, useT } from '@/lib/i18n'
import type { OrderPackage } from './orders-api'
import { groupByType, selectedWeightKg } from './order-list'

/**
 * Ô chọn kiện của form đơn hàng (LM-104): kiện đã nhận ở kho, nhóm theo loại kiện; mỗi nhóm có ô "chọn cả nhóm". Dưới danh sách là
 * tổng kiện và khối lượng đã chọn (theo khối lượng loại kiện). Không có kiện nào thì nói lý do: chỉ kiện đã nhận ở kho mới vào đơn.
 */
export function OrderPackagePicker({ packages, value, onChange, error }: {
  packages: readonly OrderPackage[]
  value: readonly string[]
  onChange: (next: string[]) => void
  error?: string
}) {
  const t = useT()
  const format = useFormat()
  const titleId = useId()
  const chosen = new Set(value)
  const groups = groupByType(packages, t('orders.form.unknownType'))

  function toggle(ids: readonly string[], on: boolean) {
    const next = new Set(chosen)
    for (const id of ids) {
      if (on) next.add(id)
      else next.delete(id)
    }
    // Giữ thứ tự của danh sách để đơn liệt kê kiện ổn định
    onChange(packages.map((item) => item.package.id).filter((id) => next.has(id)))
  }

  return (
    <fieldset aria-labelledby={titleId} aria-invalid={error ? true : undefined} className="flex min-w-0 flex-col gap-2">
      <legend id={titleId} className="mb-1.5 text-small font-semibold text-ink-2">{t('orders.form.packages')}</legend>
      {packages.length === 0 ? (
        <p className="rounded-md border border-border bg-surface p-3 text-small text-ink-2">{t('orders.form.noPackages')}</p>
      ) : (
        <div className="flex max-h-80 flex-col overflow-y-auto rounded-md border border-line-strong">
          {groups.map((group) => {
            const ids = group.items.map((item) => item.package.id)
            const all = ids.every((id) => chosen.has(id))
            return (
              <div key={group.typeId} className="border-b border-line-soft last:border-b-0">
                <div className="sticky top-0 z-1 bg-n-25 px-3 py-2">
                  <Checkbox
                    checked={all}
                    onCheckedChange={(checked) => toggle(ids, checked === true)}
                    label={<span className="font-medium">{t('orders.form.selectType', { name: `${group.name} (${format.integer(ids.length)})` })}</span>}
                  />
                </div>
                <ul className="flex flex-col py-1">
                  {group.items.map(({ package: pkg, type }) => (
                    <li key={pkg.id} className="px-3 py-1.5 pl-9">
                      <Checkbox
                        checked={chosen.has(pkg.id)}
                        onCheckedChange={(checked) => toggle([pkg.id], checked === true)}
                        label={
                          <span className="flex flex-wrap items-baseline gap-x-2">
                            <span className="font-mono text-caption text-ink-strong">{pkg.id}</span>
                            {type ? (
                              <span className="text-small text-ink-3">
                                {t('orders.form.packageMeta', { dimensions: format.dimensions(type.lengthCm, type.widthCm, type.heightCm), weight: format.weight(type.weightKg) })}
                              </span>
                            ) : null}
                          </span>
                        }
                      />
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      )}
      <p role="status" className="text-small text-ink-2 tabular-nums">
        {t('orders.form.selected', { count: value.length, weight: format.weight(selectedWeightKg(packages, value)) })}
      </p>
      {error ? <p role="alert" className="text-fine text-danger">{error}</p> : null}
    </fieldset>
  )
}
