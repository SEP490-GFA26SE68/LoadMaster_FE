import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import { cn } from '@/lib/utils'

/**
 * Chữ thân của trang pháp lý: 16 px ở mọi thiết bị, dòng không dài quá khoảng 72 ký tự. Đoạn ngắn và danh sách thay cho khối chữ dài.
 */
const MEASURE = 'max-w-[72ch]'

export function LegalText({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('m-0 text-body-lg text-pretty text-ink-1', MEASURE, className)}>{children}</p>
}

/** Danh sách gạch đầu dòng; mỗi mục là một `<li>` do nơi gọi đưa vào. */
export function LegalList({ children }: { children: ReactNode }) {
  return <ul className={cn('m-0 flex list-disc flex-col gap-1.5 pl-6 text-body-lg text-ink-1 marker:text-ink-3', MEASURE)}>{children}</ul>
}

/**
 * Liên kết trong đoạn văn tới một trang công khai khác (gạch chân — liên kết trong đoạn văn, không phải nút). Giữ `?lang=` khi sang trang
 * kia. Trên máy cảm ứng, dòng chứa nó cao ít nhất 56 px nên vẫn dễ chạm.
 */
export function LegalLink({ to, children }: { to: string; children: ReactNode }) {
  const { search } = useLocation()
  return (
    <LegalText className="pointer-coarse:flex pointer-coarse:min-h-14 pointer-coarse:items-center">
      <Link
        to={{ pathname: to, search }}
        className="font-medium text-primary underline underline-offset-2 hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {children}
      </Link>
    </LegalText>
  )
}

export type LegalSectionSpec = {
  /** Neo của mục (`#form-lien-he`) — slug tiếng Việt không dấu, không đổi theo ngôn ngữ. */
  readonly id: string
  readonly title: string
  readonly content: ReactNode
}

/**
 * Một mục đánh số. Số nằm ngoài `<h2>` và chỉ để nhìn: tên truy cập của tiêu đề và của vùng là đúng chữ tiêu đề; thứ tự đã có ở danh sách
 * đánh số của mục lục. `<h2>` nhận focus khi tới bằng neo (`useHashScroll`).
 */
export function LegalSection({ section, number }: { section: LegalSectionSpec; number: number }) {
  const titleId = `${section.id}-tieu-de`
  return (
    <section
      id={section.id}
      aria-labelledby={titleId}
      className="scroll-mt-24 border-t border-line-soft pt-7 first:border-t-0 first:pt-0 print:pt-5"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-0.5 flex size-7 flex-none items-center justify-center rounded-sm bg-tint-blue font-mono text-caption font-semibold text-tint-blue-fg tabular-nums print:bg-transparent"
        >
          {String(number).padStart(2, '0')}
        </span>
        <h2 id={titleId} tabIndex={-1} className="m-0 font-display text-h2 font-[650] text-balance text-ink-strong outline-none font-stretch-108%">
          {section.title}
        </h2>
      </div>
      <div className="mt-3.5 flex flex-col gap-3 sm:pl-10">{section.content}</div>
    </section>
  )
}
