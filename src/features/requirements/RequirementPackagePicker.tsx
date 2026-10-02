import { useId, useState } from 'react'
import { Checkbox } from '@/components/ui/Checkbox'
import { Input } from '@/components/ui/Input'
import { useFormat, useT } from '@/lib/i18n'
import type { RequirementPackage } from './requirements-api'
import { filterPickerPackages, groupByType, selectedWeightKg } from './requirement-list'

/**
 * Ô chọn kiện của form yêu cầu giao (FE-4b-02): kiện còn ở kho kiện, nhóm theo loại kiện (kiện không gắn loại thì theo loại hàng); mỗi
 * nhóm có ô "chọn cả nhóm". Ô lọc trên cùng lọc nhanh theo điểm đến ghi trong file hoặc mã kiện — kiện đã chọn luôn ở lại. Dưới danh
 * sách là tổng kiện và khối lượng đã chọn. Không có kiện nào thì nói lý do: chỉ kiện đã nhập, không cờ, chưa thuộc yêu cầu nào mới
 * vào yêu cầu được. `disabled`: yêu cầu đã vào chuyến, kiện không đổi được nữa.
 */
export function RequirementPackagePicker({ packages, value, onChange, error, disabled = false }: {
  packages: readonly RequirementPackage[]
  value: readonly string[]
  onChange: (next: string[]) => void
  error?: string
  disabled?: boolean
}) {
  const t = useT()
  const format = useFormat()
  const titleId = useId()
  const [filter, setFilter] = useState('')
  const chosen = new Set(value)
  const visible = filterPickerPackages(packages, filter, value)
  const groups = groupByType(visible, (handlingClass) => t('requirements.form.classGroup', { name: t(`common.handlingClasses.${handlingClass}`) }))

  function toggle(ids: readonly string[], on: boolean) {
    const next = new Set(chosen)
    for (const id of ids) {
      if (on) next.add(id)
      else next.delete(id)
    }
    // Giữ thứ tự của danh sách để yêu cầu liệt kê kiện ổn định
    onChange(packages.map((item) => item.package.id).filter((id) => next.has(id)))
  }

  return (
    <fieldset disabled={disabled} aria-labelledby={titleId} aria-invalid={error ? true : undefined} className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
      <legend id={titleId} className="mb-1.5 text-small font-semibold text-ink-2">{t('requirements.form.packages')}</legend>
      {packages.length === 0 ? (
        <p className="rounded-md border border-border bg-surface p-3 text-small text-ink-2">{t('requirements.form.noPackages')}</p>
      ) : (
        <>
          {disabled ? null : (
            <Input
              type="search"
              aria-label={t('requirements.form.filterPackages')}
              placeholder={t('requirements.form.filterPackages')}
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            />
          )}
          {groups.length === 0 ? (
            <p className="rounded-md border border-border bg-surface p-3 text-small text-ink-2">{t('requirements.form.noMatch')}</p>
          ) : (
            <div className="flex max-h-72 flex-col overflow-y-auto rounded-md border border-line-strong">
              {groups.map((group) => {
                const ids = group.items.map((item) => item.package.id)
                const all = ids.every((id) => chosen.has(id))
                return (
                  <div key={group.key} className="border-b border-line-soft last:border-b-0">
                    <div className="sticky top-0 z-1 bg-n-25 px-3 py-2">
                      <Checkbox
                        checked={all}
                        onCheckedChange={(checked) => toggle(ids, checked === true)}
                        label={<span className="font-medium">{t('requirements.form.selectType', { name: `${group.name} (${format.integer(ids.length)})` })}</span>}
                      />
                    </div>
                    <ul className="flex flex-col py-1">
                      {group.items.map(({ package: pkg }) => (
                        <li key={pkg.id} className="px-3 py-1.5 pl-9">
                          <Checkbox
                            checked={chosen.has(pkg.id)}
                            onCheckedChange={(checked) => toggle([pkg.id], checked === true)}
                            label={
                              <span className="flex flex-col">
                                <span className="flex flex-wrap items-baseline gap-x-2">
                                  <span className="font-mono text-caption text-ink-strong">{pkg.id}</span>
                                  <span className="text-small text-ink-3">
                                    {t('requirements.form.packageMeta', { dimensions: format.dimensions(pkg.lengthCm, pkg.widthCm, pkg.heightCm), weight: format.weight(pkg.weightKg) })}
                                  </span>
                                </span>
                                <span className="text-note text-ink-3">{pkg.destination}</span>
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
        </>
      )}
      <p role="status" className="text-small text-ink-2 tabular-nums">
        {t('requirements.form.selected', { count: value.length, weight: format.weight(selectedWeightKg(packages, value)) })}
      </p>
      {error ? <p role="alert" className="text-fine text-danger">{error}</p> : null}
    </fieldset>
  )
}
