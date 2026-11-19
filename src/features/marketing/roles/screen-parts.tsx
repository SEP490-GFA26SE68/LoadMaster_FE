import type { CSSProperties, ReactNode } from 'react'
import { LogoMark } from '@/components/brand/LogoMark'
import type { DeadlineStatus } from '@/domain/routing'
import { stopColor, stopForeground } from '@/lib/stops'
import { cn } from '@/lib/utils'
import type { RoleDevice } from './roles-model'

/**
 * Mảnh dựng màn thu nhỏ trong khung thiết bị. Mọi cỡ tính bằng em (cỡ chữ gốc của thân màn co theo bề rộng khung — `roles.css`), nên
 * chip, chấm điểm giao và nút ở đây là bản vẽ lại của `Badge`, `StopDot` và nút chính theo đúng token, không phải component bấm được.
 */

/** Phần bề rộng khung làm cỡ chữ gốc: màn máy tính nhiều cột nhất nên chữ nhỏ nhất so với khung. */
const DEVICE_EM: Readonly<Record<RoleDevice, number>> = { laptop: 46, tablet: 36, phone: 17 }

/** Màn thu nhỏ: container co theo bề rộng, nền vùng làm việc của ứng dụng. */
export function Screen({ device, className, children }: { device: RoleDevice; className?: string; children: ReactNode }) {
  return (
    <div className="roles-screen h-full overflow-hidden">
      <div
        className={cn('roles-screen-body flex h-full flex-col bg-app text-ink-1', className)}
        style={{ '--roles-em': DEVICE_EM[device] } as CSSProperties}
      >
        {children}
      </div>
    </div>
  )
}

/** Dải trời đầu màn: logo, tiêu đề, phần phải tuỳ màn. */
export function ScreenBar({ title, logo = true, children, className }: { title: ReactNode; logo?: boolean; children?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-none items-center gap-[0.6em] bg-(image:--sky) px-[0.9em] text-sky-text', className)}>
      {logo ? <LogoMark tone="dark" className="size-[1.4em] flex-none" /> : null}
      <span className="min-w-0 font-display font-bold font-stretch-108%">{title}</span>
      {children ? <span className="ml-auto flex items-center gap-[0.5em]">{children}</span> : null}
    </div>
  )
}

const DEADLINE_CHIP: Readonly<Record<DeadlineStatus, string>> = {
  OK: 'bg-badge-success-bg text-badge-success-fg [--dot:var(--green-500)]',
  AT_RISK: 'bg-badge-warning-bg text-badge-warning-fg [--dot:var(--amber-500)]',
  MISSED: 'bg-badge-danger-bg text-badge-danger-fg [--dot:var(--red-500)]',
}

/** Chip mức hạn như `DeadlineChip` của màn Giám sát: kịp hạn chấm đặc, sát và trễ hạn chấm có quầng; luôn kèm chữ. */
export function MiniDeadline({ status, children }: { status: DeadlineStatus; children: ReactNode }) {
  return (
    <MiniChip className={DEADLINE_CHIP[status]} dot={status === 'OK' ? 'solid' : 'halo'}>
      {children}
    </MiniChip>
  )
}

/** Chip trạng thái viên thuốc, cỡ em. */
export function MiniChip({ className, dot, children }: { className: string; dot?: 'solid' | 'halo'; children: ReactNode }) {
  return (
    <span className={cn('inline-flex flex-none items-center gap-[0.45em] rounded-[0.45em] px-[0.6em] py-[0.3em] text-[0.82em] leading-none font-semibold whitespace-nowrap', className)}>
      {dot ? (
        <span
          className={cn(
            'size-[0.55em] flex-none rounded-full bg-(--dot)',
            dot === 'halo' && 'shadow-[0_0_0_0.22em_color-mix(in_srgb,var(--dot)_25%,transparent)]',
          )}
        />
      ) : null}
      {children}
    </span>
  )
}

/** Số điểm giao trên màu định danh, như `StopDot`. */
export function MiniStop({ stop, className }: { stop: number; className?: string }) {
  return (
    <span
      className={cn('grid size-[1.6em] flex-none place-items-center rounded-full font-display leading-none font-semibold tabular-nums', className)}
      style={{ background: stopColor(stop), color: stopForeground(stop) }}
    >
      {stop}
    </span>
  )
}

/** Hình nút chính (gradient cyan, chữ tối) — chỉ là hình, không bấm được. */
export function MiniPrimary({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('grid place-items-center rounded-[0.6em] border border-primary-fill-border bg-linear-to-b from-primary-fill-from to-primary-fill-to px-[0.9em] font-semibold text-on-primary', className)}>
      {children}
    </span>
  )
}

/** Thẻ trắng của màn, bo theo `--r-lg`. */
export function MiniCard({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('rounded-[0.8em] border border-border bg-bg', className)}>{children}</div>
}

/** Thanh tiến độ: rãnh xám, phần đã xong thang azure ("đang chạy"). */
export function MiniMeter({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn('block h-[0.4em] overflow-hidden rounded-full bg-n-100', className)}>
      <span className="block h-full rounded-full bg-azure-500" style={{ width: `${Math.round(value * 1000) / 10}%` }} />
    </span>
  )
}
