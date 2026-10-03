import { useId } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Switch } from '@/components/ui/Switch'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'
import { useDeviceLocation, type DeviceLocationState } from './useDeviceLocation'

/**
 * Công tắc "Dùng GPS thật" trên màn điểm giao khi chuyến Đang vận chuyển (FE-6-13). Một hàng 56 px: nhãn công tắc, nhãn nguồn vị trí
 * ("GPS" khi đang gửi, "Mô phỏng" khi không) và công tắc; dưới là một dòng trạng thái — đang chờ quyền, đã gửi lúc nào, hoặc vì sao đã
 * về mô phỏng — và câu nói rõ khi chưa có máy chủ thì vị trí chỉ hiện trong trình duyệt này. Thiết bị không có định vị: công tắc mờ kèm
 * lý do. Gỡ màn chuyến là dừng theo dõi (`useDeviceLocation`).
 */
export function DriverGpsToggle({ tripId }: { tripId: string }) {
  const t = useT()
  const switchId = useId()
  const noteId = useId()
  const { supported, enabled, state, toggle } = useDeviceLocation(tripId)
  const active = state.status === 'active'
  return (
    <section aria-label={t('driver.gps.title')} className="flex flex-none flex-col gap-1 border-b border-border bg-bg px-4 pb-2.5">
      <div className="flex min-h-14 items-center gap-3">
        <label htmlFor={switchId} className="flex min-h-14 flex-1 cursor-pointer items-center font-semibold">{t('driver.gps.toggle')}</label>
        <Badge tone={active ? 'success' : 'neutral'} className="h-8 px-3 text-body-lg">
          {t(`monitoring.location.sources.${active ? 'GPS' : 'SIMULATED'}`)}
        </Badge>
        {/* Vùng chạm 56 px quanh công tắc 36 × 20 (mục 10) */}
        <Switch
          id={switchId}
          checked={enabled}
          disabled={!supported}
          aria-describedby={noteId}
          onCheckedChange={toggle}
          className="after:absolute after:-inset-x-2.5 after:-inset-y-4.5 after:content-['']"
        />
      </div>
      {/* Thiết bị không có định vị là lý do cố định của công tắc mờ, không phải thông báo mới: không `role="status"` */}
      {supported ? <GpsStatus state={state} /> : <p className="m-0 font-medium text-text-2">{t('driver.gps.stopped.unsupported')}</p>}
      <p id={noteId} className="m-0 text-text-3">{t('driver.gps.localOnly')}</p>
    </section>
  )
}

/** Dòng trạng thái của GPS thật; chưa bật lần nào thì không có dòng nào. */
function GpsStatus({ state }: { state: DeviceLocationState }) {
  const t = useT()
  const format = useFormat()
  if (state.status === 'off' && state.reason === undefined) return null
  const warn = state.status === 'off' && state.reason !== 'user'
  return (
    <p role="status" className={warn ? 'm-0 rounded-md border border-badge-warning-border bg-badge-warning-bg px-3 py-2 font-medium text-badge-warning-fg' : 'm-0 text-text-2'}>
      {state.status === 'requesting'
        ? t('driver.gps.requesting')
        : state.status === 'active'
          ? t('driver.gps.sent', { time: format.time(state.sentAt) })
          : state.reason === 'error'
            ? t('driver.gps.stopped.error', { message: dataErrorMessage(state.error, t) })
            : t(`driver.gps.stopped.${state.reason ?? 'user'}`)}
    </p>
  )
}
