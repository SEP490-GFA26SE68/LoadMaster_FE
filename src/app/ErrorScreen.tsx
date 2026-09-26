import type { ReactNode } from 'react'
import { EmptyTripsIllustration } from '@/features/trips/EmptyTripsIllustration'
import { cn } from '@/lib/utils'
import { BrandMark } from './BrandMark'

/**
 * Khung màn lỗi dùng chung (404, lỗi render, 403): logo, hình minh hoạ, mã, tiêu đề, mô tả và nút. Màn không có dữ liệu nghiệp vụ
 * nên được căn giữa và có hình minh hoạ (AGENTS mục 5).
 */
export function ErrorScreen({ code, title, description, actions, className }: {
  code: string
  title: string
  description: string
  actions: ReactNode
  className?: string
}) {
  return (
    <main className={cn('flex min-h-dvh flex-1 flex-col items-center justify-center gap-8 overflow-auto bg-(image:--field) px-6 py-16 in-[.app-shell]:min-h-0 in-[.app-shell]:bg-none', className)}>
      <div className="flex items-center gap-2.5">
        <BrandMark />
        <span className="font-display text-[18px] leading-none font-bold tracking-[-0.2px] font-stretch-112%">
          Load<span className="text-primary">Master</span>
        </span>
      </div>

      <div className="flex w-full max-w-120 flex-col items-center gap-6 rounded-lg border border-border bg-bg px-8 py-10 text-center shadow-card">
        <EmptyTripsIllustration />
        <div className="flex flex-col items-center gap-2">
          <span className="font-mono text-body font-medium text-text-3">{code}</span>
          <h1 className="text-h1 font-semibold tracking-[-0.01em]">{title}</h1>
          <p className="text-body text-pretty text-text-2">{description}</p>
        </div>
        <div className="flex gap-2">{actions}</div>
      </div>
    </main>
  )
}
