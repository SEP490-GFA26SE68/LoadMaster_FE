import { Banner } from '@/components/Banner'
import { Spinner } from '@/components/ui/Spinner'
import { serverAuditRow } from '@/features/admin/server-audit-rows'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'
import { usePackageHistoryQuery } from './usePackagePoolQuery'

/**
 * Lịch sử kiện bản máy chủ: các dòng nhật ký về kiện, mới nhất trước — việc là nhãn hành động của Nhật ký máy chủ (mã lạ hiện nguyên mã),
 * dòng dưới là chi tiết đọc được, rồi giờ và người làm ("Hệ thống" khi máy chủ tự ghi). Chưa có dòng nào thì một câu.
 */
export function PackageHistorySection({ titleId, packageId }: { titleId: string; packageId: string }) {
  const t = useT()
  const format = useFormat()
  const history = usePackageHistoryQuery(packageId)
  const rows = (history.data ?? []).map((entry) => serverAuditRow(entry, t, format))

  return (
    <section aria-labelledby={`${titleId}-history`} className="flex flex-col gap-2">
      <h3 id={`${titleId}-history`} className="text-body font-semibold text-ink-strong">{t('sourcing.detail.history')}</h3>
      {history.isPending ? (
        <div className="flex justify-center py-4"><Spinner /></div>
      ) : history.error ? (
        <Banner tone="danger">{dataErrorMessage(history.error, t)}</Banner>
      ) : rows.length === 0 ? (
        <p className="text-small text-ink-2">{t('sourcing.detail.noHistory')}</p>
      ) : (
        <ol aria-labelledby={`${titleId}-history`} className="flex flex-col">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-col gap-0.5 border-l border-border py-1.5 pl-3">
              <span className="text-small text-ink-1">{row.action}</span>
              {row.details ? <span className="text-fine text-ink-2">{row.details}</span> : null}
              <span className="text-fine text-ink-3 tabular-nums">
                {t('sourcing.detail.historyBy', { time: format.time(row.at), date: format.date(row.at), name: row.actor })}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
