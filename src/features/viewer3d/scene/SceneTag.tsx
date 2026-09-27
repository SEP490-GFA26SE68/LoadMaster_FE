import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Vai trò của nhãn neo trong khung 3D (V2.3 `.ctag`): kiện đang chọn (trắng), hiện tại (vàng --highlight như viền kiện), tiếp theo
 * (cyan như viền --info), cảnh báo (hổ phách), lỗi cứng (đỏ); `plain` cho số đo và chú thích không có chấm.
 */
export type SceneTagTone = 'selected' | 'current' | 'next' | 'warn' | 'bad' | 'plain'

const FRAME: Record<SceneTagTone, string> = {
  selected: 'border-glass-dark-text/50',
  current: 'border-highlight/55',
  next: 'border-cyan-400/70',
  warn: 'border-amber-500/60 bg-amber-700/50 text-amber-200',
  bad: 'border-red-500/75',
  plain: 'border-glass-dark-border',
}

const DOT: Record<Exclude<SceneTagTone, 'plain'>, string> = {
  selected: 'bg-glass-dark-text',
  current: 'bg-highlight shadow-[0_0_8px_var(--highlight)]',
  next: 'bg-cyan-400',
  warn: 'bg-amber-500',
  bad: 'bg-red-500',
}

/**
 * Nhãn kính tối trên nền 3D: dòng đầu là vai trò (· điểm giao) kèm chấm màu, dòng sau là mã kiện mono cyan. Nền đặc 85 % thay cho
 * `backdrop-filter`: nhãn đổi chỗ mỗi frame khi kéo camera, làm mờ nền lại mỗi frame thì tốn trên máy yếu. Tablet và điện thoại
 * giữ chữ 16 px (mục 10).
 */
export function SceneTag({ tone = 'plain', title, code, mono = false, dashed = false, className, children }: {
  tone?: SceneTagTone
  title?: ReactNode
  code?: ReactNode
  /** Số đo ("Vách phải 10 cm"): một dòng mono */
  mono?: boolean
  /** Vị trí gốc khi kéo: viền nét đứt */
  dashed?: boolean
  className?: string
  children?: ReactNode
}) {
  return (
    <span
      data-scene-tag={tone}
      className={cn(
        'inline-flex flex-col items-start gap-0.5 rounded-md border bg-panel-dark/85 px-2.5 py-1.5 text-left whitespace-nowrap',
        'text-body-lg leading-tight text-glass-dark-text shadow-e2 xl:text-fine',
        FRAME[tone],
        dashed && 'border-dashed border-glass-dark-muted/60 text-glass-dark-muted',
        mono && 'font-mono',
        className,
      )}
    >
      {title !== undefined ? (
        <span className={cn('flex items-center gap-1.5', !mono && 'font-semibold', tone !== 'warn' && !dashed && 'text-sky-text')}>
          {tone !== 'plain' ? <span aria-hidden className={cn('size-2 flex-none rounded-full', DOT[tone])} /> : null}
          <span>{title}</span>
        </span>
      ) : null}
      {code !== undefined ? <span className="font-mono text-body-lg text-cyan-200 xl:text-note">{code}</span> : null}
      {children}
    </span>
  )
}
