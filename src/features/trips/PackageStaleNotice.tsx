import { Banner } from '@/components/Banner'
import { useT } from '@/lib/i18n'
import { staleOnSave } from './package-stale'
import { useTripRevisionsQuery } from './useTripsQuery'

/**
 * Cảnh báo đầu form kiện (V2.3 `ChiTietChuyenKien`): lưu thay đổi sẽ làm revision đang hiển thị lỗi thời và đưa chuyến về Cần xem lại
 * (D-31). Đọc revision thật của chuyến; chưa tối ưu hoặc bản hiển thị đã lỗi thời thì không hiện gì.
 */
export function PackageStaleNotice({ tripId }: { tripId: string }) {
  const t = useT()
  const query = useTripRevisionsQuery(tripId)
  const stale = query.data ? staleOnSave(query.data.trip, query.data.revisions) : null
  if (!stale) return null
  return (
    <Banner tone="warning" className="flex-none px-3 py-2.5 text-small leading-4.75 text-amber-700">
      <strong className="font-semibold">{t('trips.form.staleLead', { revision: stale.revisionId })}</strong>{' '}
      {stale.approved ? t('trips.form.staleApproved') : t('trips.form.staleOptimized')}
    </Banner>
  )
}
