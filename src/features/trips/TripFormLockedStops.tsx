import { fieldLabelClass } from '@/components/ui/field-styles'
import { Input } from '@/components/ui/Input'
import { useT } from '@/lib/i18n'
import type { DeliveryStop } from '@/lib/mock-db'
import { stopColor, stopForeground } from '@/lib/stops'

const COLUMNS = 'grid grid-cols-[28px_minmax(0,1.28fr)_minmax(0,1.5fr)_140px_128px] items-center gap-x-3'

/**
 * Điểm giao khi kho đã bắt đầu xếp (D-45, V2.3 SuaChuyenKhoa.jpg): bảng gọn bốn cột chỉ xem — nhãn cột một lần ở đầu, mỗi điểm một
 * hàng ô vô hiệu hoá. Form không gửi các ô này: sửa khung chuyến lúc đó chỉ đổi tên, ngày chạy, tài xế. Tên truy cập của từng ô đủ số
 * điểm ("Tên điểm giao 2") nên trình đọc màn hình không cần nhãn cột.
 */
export function TripFormLockedStops({ stops }: { stops: readonly DeliveryStop[] }) {
  const t = useT()
  return (
    <div className="-ml-10 overflow-x-auto max-sm:ml-0">
      <div className="flex min-w-160 flex-col gap-2.5">
        <div aria-hidden className={COLUMNS}>
          <span />
          <span className={fieldLabelClass}>{t('trips.create.stopField.name')}</span>
          <span className={fieldLabelClass}>{t('trips.create.stopField.address')}</span>
          <span className={fieldLabelClass}>{t('trips.create.stopField.phone')}</span>
          <span className={fieldLabelClass}>{t('trips.create.stopField.contactName')}</span>
        </div>
        <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
          {stops.map((stop, index) => {
            const number = index + 1
            return (
              <li key={stop.id} className={COLUMNS}>
                <span
                  aria-hidden
                  className="ml-px grid size-6.5 place-items-center rounded-[8px] font-display text-caption font-bold"
                  style={{ background: stopColor(number), color: stopForeground(number) }}
                >
                  {number}
                </span>
                <Input disabled aria-label={t('trips.create.stopName', { number })} defaultValue={stop.name} />
                <Input disabled aria-label={t('trips.create.stopAddress', { number })} defaultValue={stop.address} />
                <Input disabled aria-label={t('trips.create.stopPhone', { number })} defaultValue={stop.phone ?? ''} />
                <Input disabled aria-label={t('trips.create.stopContact', { number })} defaultValue={stop.contactName ?? ''} />
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
