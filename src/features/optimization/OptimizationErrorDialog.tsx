import { AlertCircle, OctagonAlert, RotateCw, TriangleAlert, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { OptimizationServiceErrorCode } from '@/services/optimization'

/** Một lỗi đầu vào service trả về, đã dịch; `error` chặn, `warning` chỉ báo. */
export type FailureIssue = { readonly severity: 'error' | 'warning'; readonly message: string }

export type OptimizationFailure =
  | { readonly kind: 'service'; readonly code: OptimizationServiceErrorCode }
  | { readonly kind: 'failed'; readonly issues: readonly FailureIssue[] }

/**
 * Tối ưu không ra kết quả (LM-048, V2.3 `HopThoaiToiUu.jpg`): lỗi service (không phản hồi, quá giờ, worker dừng, bộ tối ưu lỗi) có nút
 * Thử lại; `status: FAILED` liệt kê từng lỗi đầu vào kèm nhãn Lỗi / Cảnh báo và chỉ có Đóng. Không có nút lý do không làm gì (D-20).
 */
export function OptimizationErrorDialog({ failure, onRetry, onClose }: {
  failure: OptimizationFailure
  onRetry: () => void
  onClose: () => void
}) {
  const t = useT()
  const service = failure.kind === 'service'
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="w-114">
        <DialogHeader
          icon={OctagonAlert}
          tone="danger"
          title={service ? t('optimization.error.title') : t('optimization.error.failedTitle')}
          description={service ? t(`optimization.error.${failure.code}`) : t('optimization.error.failedDescription')}
        >
          <DialogClose
            aria-label={t('optimization.error.dismiss')}
            className="-mt-1 -mr-2 grid size-8 flex-none place-items-center rounded-md text-ink-3 transition-colors duration-(--dur-fast) ease-standard hover:bg-surface hover:text-ink-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <X className="size-4.5" strokeWidth={1.75} aria-hidden />
          </DialogClose>
        </DialogHeader>
        {failure.kind === 'failed' ? (
          <ul className="m-0 mx-7 mt-4 flex list-none flex-col overflow-hidden rounded-md border border-border p-0">
            {failure.issues.map((issue) => {
              const error = issue.severity === 'error'
              const Icon = error ? AlertCircle : TriangleAlert
              return (
                <li key={`${issue.severity}-${issue.message}`} className="flex items-start gap-2.5 border-t border-line-soft px-3.5 py-2.75 first:border-t-0">
                  <Icon aria-hidden className={cn('mt-0.5 size-4 flex-none', error ? 'text-red-700' : 'text-amber-700')} strokeWidth={1.75} />
                  <span className="flex min-w-0 flex-col text-body text-ink-strong">
                    <span className={cn('text-caption font-semibold', error ? 'text-red-700' : 'text-amber-700')}>
                      {error ? t('optimization.check.error') : t('optimization.check.warning')}
                    </span>
                    {issue.message}
                  </span>
                </li>
              )
            })}
          </ul>
        ) : null}
        <div className="h-4.5" />
        <DialogFooter>
          {service ? (
            <>
              <Button variant="ghost" onClick={onClose}>{t('optimization.error.close')}</Button>
              <Button variant="primary" onClick={onRetry}><RotateCw strokeWidth={1.75} />{t('optimization.error.retry')}</Button>
            </>
          ) : (
            <Button variant="secondary" onClick={onClose}>{t('optimization.error.close')}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
