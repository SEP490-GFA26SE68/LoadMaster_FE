import { Check, ChevronDown, X } from 'lucide-react'
import { useState } from 'react'
import { Checkbox } from '@/components/ui/Checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { RadioGroup, RadioGroupItem } from '@/components/ui/RadioGroup'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Switch } from '@/components/ui/Switch'
import { PERIOD_PRESETS, type PeriodPreset } from '@/features/manager/dashboard-period'
import { useT } from '@/lib/i18n'
import type { SheetSample } from '../design-system-api'
import { FilterChip } from '../samples'
import { SheetCard } from '../SheetLayout'

const PERIOD_LABELS = {
  '7-ngay': 'manager.period.presets.last7',
  '30-ngay': 'manager.period.presets.last30',
  'thang-nay': 'manager.period.presets.thisMonth',
  'tuy-chon': 'manager.period.presets.custom',
} as const satisfies Record<PeriodPreset, string>

/** Giá trị "mọi xe" của chip Xe (Radix không nhận chuỗi rỗng làm giá trị mục). */
const ALL = 'tat-ca'

/**
 * Điều khiển chọn thật, bấm được: ô chọn, radio, công tắc, nhóm nút chọn một, chip lọc. Nhãn là nhãn của màn đang dùng chúng
 * (Thiết lập tối ưu, Kiện hàng, Planner, Bảng điều khiển). Kỳ báo cáo do trang giữ để đổi luôn hai ô số liệu kính.
 */
export function ChoicesCard({
  sample,
  period,
  onPeriodChange,
}: {
  sample: SheetSample | undefined
  period: PeriodPreset
  onPeriodChange: (period: PeriodPreset) => void
}) {
  const t = useT()
  const [mode, setMode] = useState<'loading' | 'unloading'>('loading')
  const [vehicleId, setVehicleId] = useState(ALL)
  const [onlyFragile, setOnlyFragile] = useState(true)
  const vehicleName = sample?.vehicles.find((vehicle) => vehicle.id === vehicleId)?.name ?? t('common.filters.all')

  return (
    <SheetCard title={t('designSystem.components.choices.title')}>
      <div className="flex flex-wrap items-center gap-x-4.5 gap-y-2.5">
        <Checkbox defaultChecked label={t('trips.packages.onlyFragile')} />
        <Checkbox label={t('trips.packages.onlyIssues')} />
        <Checkbox disabled label={t('trips.form.stackable')} />
      </div>
      <RadioGroup aria-label={t('optimization.method')} defaultValue="MOCK" className="flex-row flex-wrap gap-x-4.5 gap-y-2.5">
        <RadioGroupItem value="MOCK" label={t('optimization.methods.MOCK')} />
        <RadioGroupItem value="EP_DBLF" disabled label={t('optimization.methods.EP_DBLF')} />
        <RadioGroupItem value="GA" disabled label={t('optimization.methods.GA')} />
      </RadioGroup>
      <Switch
        defaultChecked
        label={
          <span className="flex flex-col">
            {t('optimization.enforceLifo')}
            <span className="text-fine text-ink-3">{t('optimization.lifoHint')}</span>
          </span>
        }
      />
      <Switch label={t('optimization.lowCenterOfGravity')} />

      <div className="flex flex-wrap items-center gap-2.5">
        <SegmentedControl
          ariaLabel={t('designSystem.components.choices.simulation')}
          floating={false}
          value={mode}
          onChange={setMode}
          options={[
            { value: 'loading', label: t('viewer.operations.loading') },
            { value: 'unloading', label: t('viewer.operations.unloading') },
          ]}
        />
        <SegmentedControl
          ariaLabel={t('manager.period.label')}
          floating={false}
          value={period}
          onChange={onPeriodChange}
          options={PERIOD_PRESETS.map((value) => ({ value, label: t(PERIOD_LABELS[value]) }))}
        />
      </div>
      <p className="-mt-1.5 mb-0 text-fine text-ink-3">{t('designSystem.components.choices.periodNote')}</p>

      <div role="group" aria-label={t('common.filters.region')} className="flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <FilterChip pressed={vehicleId !== ALL}>
              {t('designSystem.components.choices.vehicleChip', { name: vehicleName })}
              <ChevronDown aria-hidden strokeWidth={1.75} />
            </FilterChip>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuRadioGroup value={vehicleId} onValueChange={setVehicleId}>
              <DropdownMenuRadioItem value={ALL}>{t('common.filters.all')}</DropdownMenuRadioItem>
              {sample?.vehicles.map((vehicle) => (
                <DropdownMenuRadioItem key={vehicle.id} value={vehicle.id}>{vehicle.name}</DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <FilterChip pressed={onlyFragile} onClick={() => setOnlyFragile(!onlyFragile)}>
          {onlyFragile ? <Check aria-hidden strokeWidth={2} /> : null}
          {t('trips.packages.onlyFragile')}
        </FilterChip>
        <FilterChip
          disabled={vehicleId === ALL && !onlyFragile}
          onClick={() => { setVehicleId(ALL); setOnlyFragile(false) }}
          className="disabled:cursor-not-allowed disabled:text-text-disabled"
        >
          <X aria-hidden strokeWidth={1.75} />{t('common.filters.clear')}
        </FilterChip>
      </div>
    </SheetCard>
  )
}
