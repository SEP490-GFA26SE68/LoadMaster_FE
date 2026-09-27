import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Banner } from '@/components/Banner'
import { EmptyState } from '@/components/EmptyState'
import { PageHero } from '@/components/PageHero'
import { Spinner } from '@/components/ui/Spinner'
import { dataErrorMessage, useT } from '@/lib/i18n'

/**
 * Khung một màn trong khung ứng dụng (LM-104): `PageHero` trên dải trời + vùng cuộn. Khi màn chưa có thân riêng, `summary` là câu đếm
 * dữ liệu thật của kho (EmptyState, không bịa số); đang tải thì spinner, lỗi của kho thì banner đỏ qua `dataErrorMessage`. Màn đã có
 * thân thì truyền `children` thay `summary`.
 */
export function ScreenShell({
  title,
  description,
  meta,
  actions,
  icon,
  loading = false,
  error,
  summary,
  children,
}: {
  title: string
  description?: string
  meta?: string
  actions?: ReactNode
  icon: LucideIcon
  loading?: boolean
  error?: unknown
  summary?: string
  children?: ReactNode
}) {
  const t = useT()
  let body: ReactNode = children
  if (error) body = <Banner tone="danger">{dataErrorMessage(error, t)}</Banner>
  else if (loading) body = <div className="flex justify-center py-12"><Spinner /></div>
  else if (summary !== undefined) body = <EmptyState icon={icon} title={summary} />
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PageHero title={title} description={description} meta={meta} actions={actions} />
      <main className="min-h-0 flex-1 overflow-y-auto px-shell py-6 max-sm:p-4">{body}</main>
    </div>
  )
}
