import type { LucideIcon } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import type { SelectOption } from '@/components/ui/SelectField'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { CAMERA_PRESETS } from '../viewer-options'
import type { CameraPreset } from '../viewer-types'

export type PlannerSelectTone = 'light' | 'glass'

/**
 * Kính tối của thanh trên Planner V2.3 (`.sel` của `Planner3D.html`): nền kính mờ, viền sáng mảnh, chữ sáng; focus đổi viền sang
 * cyan-300 vì `--primary` không đủ tương phản trên nền tối (AGENTS mục 1).
 */
const GLASS = [
  'border-sky-glass-border bg-sky-glass font-medium text-glass-dark-text hover:bg-sky-glass-hover',
  'focus-visible:border-cyan-300 [&>svg]:text-glass-dark-muted',
].join(' ')

/**
 * `Select` dùng chung (Radix) trên thanh công cụ Planner thay cho `<select>` gốc (LM-094, U-6). Planner là màn cảm ứng
 * (AGENTS mục 5): nút mở và dòng chọn cao 56px, từ `xl` về cỡ desktop như các nút cùng thanh. Chữ dài (tên điểm giao) cắt
 * bằng dấu ba chấm trong nút, đủ chữ trong danh sách. `tone="glass"`: thanh trên kính tối (V2.3); `icon` đứng trước chữ.
 */
export function PlannerSelect({ label, value, options, onValueChange, className, tone = 'light', icon: Icon }: {
  /** Tên truy cập của nút mở (không có nhãn nhìn thấy trên thanh công cụ). */
  label: string
  value: string
  options: readonly SelectOption[]
  onValueChange: (value: string) => void
  className?: string
  tone?: PlannerSelectTone
  icon?: LucideIcon
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        aria-label={label}
        className={cn(
          'h-14 min-w-0 px-2.5 text-left text-body-lg xl:h-11 xl:text-body [&>span]:min-w-0 [&>span]:truncate',
          tone === 'glass' && GLASS,
          className,
        )}
      >
        {/* Icon chỉ hiện từ 1.536 px: hàng gộp 1.366 px không đủ chỗ */}
        {Icon ? <Icon aria-hidden className="hidden size-4 flex-none 2xl:block" strokeWidth={1.5} /> : null}
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} className="h-14 text-body-lg xl:h-9 xl:text-body">
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** Góc nhìn camera: cùng một điều khiển ở thanh công cụ chế độ Xem và chế độ Chỉnh sửa. */
export function CameraSelect({ label, preset, onPreset, className, tone, icon }: {
  label: string
  preset: CameraPreset
  onPreset: (preset: CameraPreset) => void
  className?: string
  tone?: PlannerSelectTone
  icon?: LucideIcon
}) {
  const t = useT()
  return (
    <PlannerSelect
      label={label}
      value={preset}
      tone={tone}
      icon={icon}
      className={cn('w-36 flex-none xl:w-28', className)}
      options={CAMERA_PRESETS.map((value) => ({ value, label: t(`viewer.camera.${value}`) }))}
      onValueChange={(value) => {
        const next = CAMERA_PRESETS.find((candidate) => candidate === value)
        if (next) onPreset(next)
      }}
    />
  )
}
