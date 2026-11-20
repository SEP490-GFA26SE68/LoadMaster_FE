import { CalendarDays, Printer } from 'lucide-react'
import { Link, useLocation } from 'react-router'
import { SKY_FOCUS } from '@/components/sky-focus'
import { Button } from '@/components/ui/Button'
import { useFormat, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { PUBLIC_TOUCH } from '../public-chrome'
import { LEGAL_DOCS, LEGAL_PATHS, type LegalDoc } from './legal-facts'

function handlePrint() {
  window.print()
}

/**
 * Bộ chuyển giữa hai tài liệu pháp lý: khay kính của dải trời (như nhóm tab `tone="sky"`), tài liệu đang mở mang `aria-current="page"` và
 * kính cyan của thanh điều hướng. Là liên kết, không phải tab: mỗi tài liệu là một trang có địa chỉ riêng. Giữ `?lang=` khi sang trang kia.
 */
function LegalDocSwitch({ doc }: { doc: LegalDoc }) {
  const t = useT()
  const { search } = useLocation()
  return (
    <nav aria-label={t('legal.docs.label')} className="flex max-w-full rounded-[12px] border border-sky-glass-border bg-sky-glass p-1 print:hidden">
      {LEGAL_DOCS.map((item) => (
        <Link
          key={item}
          to={{ pathname: LEGAL_PATHS[item], search }}
          aria-current={item === doc ? 'page' : undefined}
          className={cn(
            'flex min-h-9 items-center rounded-md px-3 py-1.5 text-center text-body leading-5 font-medium text-sky-text-2 no-underline',
            'hover:bg-sky-glass-hover hover:text-sky-text focus-visible:outline-2 focus-visible:outline-offset-2',
            'aria-[current=page]:bg-(image:--nav-on) aria-[current=page]:font-semibold aria-[current=page]:text-sky-text aria-[current=page]:shadow-nav-on',
            'pointer-coarse:min-h-14 pointer-coarse:px-4 pointer-coarse:text-body-lg',
            SKY_FOCUS,
          )}
        >
          {t(`legal.docs.${item}`)}
        </Link>
      ))}
    </nav>
  )
}

/**
 * Đầu trang pháp lý trên dải trời: bộ chuyển tài liệu, tiêu đề, một câu mô tả, ngày cập nhật và nút "In trang này". Trang in bỏ nền dải
 * trời (trình duyệt không in nền) nên chữ đổi sang mực tối.
 */
export function LegalHeader({ doc, title, lede, updatedAt }: { doc: LegalDoc; title: string; lede: string; updatedAt: Date }) {
  const t = useT()
  const format = useFormat()
  return (
    <section aria-labelledby="legal-title" className="sky print:[background:none]!">
      <div className="flex flex-col items-start gap-4 px-4 pt-7 pb-8 md:px-shell lg:pt-10 lg:pb-10 print:px-0 print:pt-0 print:pb-4">
        <LegalDocSwitch doc={doc} />
        <h1
          id="legal-title"
          className="m-0 font-display text-section font-bold tracking-[-0.5px] text-balance text-sky-text font-stretch-112% print:text-ink-strong"
        >
          {title}
        </h1>
        <p className="m-0 max-w-160 text-intro text-pretty text-sky-text-2 print:text-ink-1">{lede}</p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <p className="m-0 flex items-center gap-2 text-body text-sky-text-2 pointer-coarse:text-body-lg print:text-ink-2">
            <CalendarDays aria-hidden className="size-4 flex-none" strokeWidth={1.5} />
            {t('legal.updated', { date: format.date(updatedAt) })}
          </p>
          <Button variant="glass" size="sm" className={cn('print:hidden', PUBLIC_TOUCH, SKY_FOCUS)} onClick={handlePrint}>
            <Printer aria-hidden strokeWidth={1.5} />
            {t('legal.print')}
          </Button>
        </div>
      </div>
    </section>
  )
}
