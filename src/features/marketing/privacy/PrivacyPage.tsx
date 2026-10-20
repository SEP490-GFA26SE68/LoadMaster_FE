import { ArrowLeft } from 'lucide-react'
import { Link, useLocation } from 'react-router'
import { Banner } from '@/components/Banner'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PUBLIC_HOME } from '@/features/auth/landing'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { PublicPage } from '../PublicPage'
import { PUBLIC_TOUCH, PUBLIC_TOUCH_TAG } from '../public-chrome'
import { PRIVACY_SECTIONS } from './privacy-sections'

/** Mục lục từ 1.024 px: dính khi cuộn, mỗi mục một liên kết tới neo (giữ `?lang` trên URL); `useHashScroll` cuộn tới mục và đặt focus vào tiêu đề. */
function PrivacyToc() {
  const t = useT()
  const { search } = useLocation()
  return (
    <nav aria-labelledby="privacy-toc" className="hidden lg:sticky lg:top-24 lg:block">
      <Card className="flex flex-col gap-2 p-4">
        <h2 id="privacy-toc" className="m-0 px-2 text-small font-semibold text-ink-2">{t('legal.toc')}</h2>
        <ol className="m-0 flex list-none flex-col p-0">
          {PRIVACY_SECTIONS.map((section) => (
            <li key={section.id}>
              <Link
                to={{ search, hash: `#${section.id}` }}
                className="flex min-h-11 items-center rounded-md px-2 text-body text-ink-1 hover:bg-n-50 hover:text-primary"
              >
                {t(section.title)}
              </Link>
            </li>
          ))}
        </ol>
      </Card>
    </nav>
  )
}

/**
 * Trang chính sách bảo mật công khai `/chinh-sach-bao-mat` (ngoài `RequireAuth`, không đòi quyền): dải trời có tiêu đề, câu mô tả và nhãn
 * "Bản nháp — chờ bộ phận pháp lý duyệt"; dưới đó mục lục (từ 1.024 px) và bài viết trên card nền đặc đè lên dải — mỗi mục một tiêu đề h2
 * có neo, chữ 16 px, độ rộng đọc khoảng 70 ký tự. Không có nút chính: trang chỉ để đọc.
 */
export function PrivacyPage() {
  const t = useT()
  const { search } = useLocation()

  return (
    <PublicPage>
      <section aria-labelledby="privacy-title" className="sky">
        <div className="flex flex-col items-start gap-4 px-4 pt-8 pb-[calc(var(--sky-overlap)+2rem)] md:px-shell lg:pt-12">
          <h1 id="privacy-title" className="m-0 font-display text-display leading-10 font-bold tracking-[-0.5px] text-sky-text font-stretch-112%">
            {t('legal.title')}
          </h1>
          <p className="m-0 max-w-150 text-body-lg text-sky-text-2">{t('legal.lede')}</p>
          <Badge shape="tag" tone="warning" className={PUBLIC_TOUCH_TAG}>{t('legal.draft')}</Badge>
        </div>
      </section>

      <div className="sky-overlap grid items-start gap-6 px-4 pb-14 md:px-shell lg:grid-cols-[15rem_minmax(0,1fr)] lg:pb-18">
        <PrivacyToc />
        <Card className="flex min-w-0 flex-col gap-8 p-5 sm:p-8">
          <Banner tone="warning" className="max-w-[70ch] text-body-lg">{t('legal.draftNote')}</Banner>
          {PRIVACY_SECTIONS.map(({ id, title, Body }) => (
            <section key={id} id={id} aria-labelledby={`${id}-title`} className="flex scroll-mt-24 flex-col gap-3 border-t border-line-soft pt-6">
              <h2 id={`${id}-title`} tabIndex={-1} className="m-0 font-display text-h2 leading-7 font-[650] text-ink-strong outline-none font-stretch-106%">
                {t(title)}
              </h2>
              <Body />
            </section>
          ))}
          <div className="border-t border-line-soft pt-6">
            <Button asChild variant="secondary" className={cn('w-full sm:w-auto', PUBLIC_TOUCH)}>
              <Link to={{ pathname: PUBLIC_HOME, search }}>
                <ArrowLeft aria-hidden strokeWidth={1.5} />
                {t('legal.back')}
              </Link>
            </Button>
          </div>
        </Card>
      </div>
    </PublicPage>
  )
}
