import { Printer } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'react-router'
import { Banner } from '@/components/Banner'
import { EmptyState } from '@/components/EmptyState'
import { PageHero } from '@/components/PageHero'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { dataErrorMessage, useT } from '@/lib/i18n'
import { PackageLabel } from './PackageLabel'
import { usePackageLabelsQuery } from './usePackagesSourceQuery'

/** `?kien=PK-0001,PK-0002`: in đúng các kiện đó; vắng là mọi kiện người đăng nhập thấy. */
function pickedIds(search: URLSearchParams): string[] | undefined {
  const raw = search.get('kien')
  return raw ? raw.split(',').map((id) => id.trim()).filter(Boolean) : undefined
}

/*
 * Bản in là một tờ riêng gắn thẳng vào `<body>`: khi in, mọi thứ khác của trang (thanh điều hướng, dải trời, toast) bị ẩn và tờ nhãn
 * hiện ra theo khổ A4, hai nhãn mỗi hàng; trên màn hình tờ này ẩn. Không phải sửa khung ứng dụng cho riêng một màn.
 */
const PRINT_CSS = `
@media screen { [data-label-sheet] { display: none; } }
@media print {
  @page { size: A4; margin: 10mm; }
  html, body { height: auto !important; overflow: visible !important; background: var(--bg) !important; }
  body > :not([data-label-sheet]) { display: none !important; }
  [data-label-sheet] { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 2mm; }
}
`

/**
 * Trang in nhãn QR `/kien-hang/nhan` (luồng 1, LM-104): lưới nhãn của các kiện trên đường dẫn (hoặc mọi kiện của công ty), nút "In
 * nhãn" gọi hộp thoại in của trình duyệt. Mã kiện trên đường dẫn không có / không thuộc công ty thì nói rõ số bị bỏ.
 */
export function PackageLabelsPage() {
  const t = useT()
  const [search] = useSearchParams()
  const ids = pickedIds(search)
  const query = usePackageLabelsQuery(ids)
  const labels = query.data ?? []
  const missing = ids === undefined || !query.isSuccess ? 0 : new Set(ids).size - labels.length

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PageHero
        title={t('sourcing.labels.title')}
        meta={query.isSuccess ? t('sourcing.labels.count', { count: labels.length }) : undefined}
        description={t('pageHero.labels')}
        back={{ to: '/kien-hang', label: t('sourcing.labels.back') }}
        actions={labels.length > 0 ? (
          <Button variant="primary" onClick={() => window.print()}>
            <Printer strokeWidth={1.5} />
            {t('sourcing.labels.print')}
          </Button>
        ) : null}
      />
      <main className="min-h-0 flex-1 overflow-auto px-shell py-6">
        {query.isPending ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : query.error ? (
          <Banner tone="danger">{dataErrorMessage(query.error, t)}</Banner>
        ) : labels.length === 0 ? (
          <EmptyState mascot="empty" title={t('sourcing.packages.empty')} description={t('sourcing.labels.emptyDescription')} />
        ) : (
          <div className="flex flex-col gap-4">
            <Banner tone="info" icon={Printer}>{t('sourcing.labels.hint')}</Banner>
            {missing > 0 ? <Banner tone="warning">{t('sourcing.labels.missing', { count: missing })}</Banner> : null}
            <section aria-label={t('sourcing.labels.sheet')} className="grid grid-cols-3 gap-3 max-lg:grid-cols-2 max-sm:grid-cols-1">
              {labels.map((label) => <PackageLabel key={label.package.id} label={label} />)}
            </section>
          </div>
        )}
      </main>
      {labels.length > 0
        ? createPortal(
            <div data-label-sheet aria-hidden>
              <style>{PRINT_CSS}</style>
              {labels.map((label) => <PackageLabel key={label.package.id} label={label} print />)}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
