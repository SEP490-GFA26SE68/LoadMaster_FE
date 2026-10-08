import type { ReactNode } from 'react'
import { Logo } from '@/components/brand/Logo'
import { Lumo, type LumoPose } from '@/components/brand/Lumo'
import { cn } from '@/lib/utils'

/**
 * Khung màn lỗi dùng chung (404, lỗi render, 403), V2.3 (`Loi404.jpg`, `Loi403.jpg`, `LoiChung.jpg`): một card trắng bo 18 đổ bóng
 * nhẹ giữa trang — Lumo, chip mã ("404", "403" hay chữ "Lỗi"), tiêu đề Archivo, một câu mô tả, nút. Màn không có dữ liệu nghiệp vụ nên
 * được căn giữa và có hình minh hoạ (AGENTS mục 5). Lumo (LM-105): `notFound` (suy nghĩ) khi không có trang, `error` (ngạc nhiên) khi
 * lỗi hoặc thiếu quyền. Không có khối chi tiết kỹ thuật hay stack trace: người dùng cuối không cần, và nó lộ tên tệp của bản build.
 *
 * Ngoài khung ứng dụng: dải trời mang logo ở đầu trang, card đè lên đáy dải. Trong khung ứng dụng (403) thanh điều hướng đã có logo
 * nên bỏ dải, card nằm giữa vùng màn.
 */
export function ErrorScreen({ code, mascot, title, description, actions, className }: {
  code: string
  mascot: LumoPose
  title: string
  description: string
  actions: ReactNode
  className?: string
}) {
  return (
    <main className={cn('flex min-h-dvh min-w-0 flex-1 flex-col bg-app in-[.app-shell]:min-h-0 in-[.app-shell]:overflow-auto', className)}>
      <div className="sky flex h-70 flex-none items-start px-shell pt-4 max-sm:px-4 in-[.app-shell]:hidden">
        <Logo tone="dark" size="sm" />
      </div>

      <div className="flex flex-1 flex-col items-center px-4 pb-12 in-[.app-shell]:justify-center in-[.app-shell]:py-10">
        <div className="-mt-14 flex w-full max-w-140 flex-col items-center gap-5 rounded-xl border border-line-soft bg-bg px-8 py-9 text-center shadow-e2 in-[.app-shell]:mt-0 max-sm:px-5">
          <Lumo pose={mascot} size="lg" />
          <div className="flex flex-col items-center gap-2.5">
            <span className="rounded-sm bg-tint-slate px-2.5 py-0.5 font-mono text-caption font-semibold text-tint-slate-fg">{code}</span>
            <h1 className="font-display text-h1 leading-8 font-bold tracking-[-0.2px] text-ink-strong font-stretch-106%">{title}</h1>
            <p className="max-w-96 text-body text-pretty text-text-2">{description}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2.5">{actions}</div>
        </div>
      </div>
    </main>
  )
}
