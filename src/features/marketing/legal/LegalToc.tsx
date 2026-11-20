import { ChevronDown, List } from 'lucide-react'
import type { MouseEvent } from 'react'
import { Link, useLocation } from 'react-router'
import { useT } from '@/lib/i18n'
import type { LegalSectionSpec } from './LegalParts'

type TocProps = { sections: readonly LegalSectionSpec[]; active: string | null }

/** Đóng mục lục thu gọn khi đã chọn một mục, để mục vừa tới không bị danh sách đẩy xuống. */
function handlePick(event: MouseEvent<HTMLAnchorElement>) {
  event.currentTarget.closest('details')?.removeAttribute('open')
}

/**
 * Danh sách đánh số của mục lục. Mỗi mục là liên kết tới neo của mục đó trên chính trang này (giữ `?lang=`): `useHashScroll` cuộn tới và
 * đưa focus vào tiêu đề mục. Mục đang đọc mang `aria-current="location"` và vạch cyan bên trái — không chỉ màu chữ.
 */
function TocList({ sections, active }: TocProps) {
  const { search } = useLocation()
  return (
    <ol className="m-0 flex list-none flex-col gap-0.5 p-0">
      {sections.map((section, index) => (
        <li key={section.id}>
          <Link
            to={{ search, hash: `#${section.id}` }}
            aria-current={section.id === active ? 'location' : undefined}
            onClick={handlePick}
            className="group flex min-h-9 items-baseline gap-2.5 rounded-r-md border-l-2 border-transparent py-2 pr-2 pl-3 text-body text-ink-2 no-underline hover:bg-surface hover:text-ink-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary aria-[current=location]:border-cyan-500 aria-[current=location]:bg-primary-bg aria-[current=location]:font-semibold aria-[current=location]:text-primary pointer-coarse:min-h-14 pointer-coarse:items-center pointer-coarse:text-body-lg"
          >
            <span aria-hidden className="w-5 flex-none font-mono text-caption text-ink-3 tabular-nums group-aria-[current=location]:text-primary pointer-coarse:text-body">
              {String(index + 1).padStart(2, '0')}
            </span>
            <span className="min-w-0 text-pretty">{section.title}</span>
          </Link>
        </li>
      ))}
    </ol>
  )
}

/**
 * Mục lục của trang pháp lý. Từ 1.024 px là cột dính bên trái, tự cuộn khi dài hơn màn; hẹp hơn là một khối `<details>` gốc đứng trên nội
 * dung — mở bằng chuột, bàn phím và trình đọc màn hình không cần JavaScript, dòng mở cao 56 px trên máy cảm ứng. Chỉ một trong hai bản
 * hiện ra (bản kia `display: none`), và không bản nào vào trang in.
 */
export function LegalToc({ sections, active }: TocProps) {
  const t = useT()
  const title = t('legal.toc.title')
  return (
    <>
      <details className="group rounded-lg border border-border bg-bg lg:hidden print:hidden">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-lg px-4 py-2.5 text-body-lg outline-none hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary pointer-coarse:min-h-14 [&::-webkit-details-marker]:hidden">
          <List aria-hidden className="size-5 flex-none text-ink-3" strokeWidth={1.5} />
          <span className="flex-1 font-semibold text-ink-strong">{title}</span>
          <span className="text-body text-ink-3 pointer-coarse:text-body-lg">{t('legal.toc.count', { count: sections.length })}</span>
          <ChevronDown aria-hidden className="size-5 flex-none text-ink-3 group-open:rotate-180" strokeWidth={1.5} />
        </summary>
        <nav aria-label={title} className="border-t border-line-soft px-2 py-2">
          <TocList sections={sections} active={active} />
        </nav>
      </details>
      <nav aria-label={title} className="sticky top-24 hidden max-h-[calc(100dvh-7.5rem)] self-start overflow-y-auto pr-1 lg:block print:hidden">
        <p className="m-0 mb-2 pl-3.5 font-display text-h3 font-[650] text-ink-strong font-stretch-106%">{title}</p>
        <TocList sections={sections} active={active} />
      </nav>
    </>
  )
}
