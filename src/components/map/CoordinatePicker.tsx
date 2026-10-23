import { Maximize2, X } from 'lucide-react'
import { lazy, Suspense, useId, useState, type FocusEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { fieldLabelClass } from '@/components/ui/field-styles'
import { Input } from '@/components/ui/Input'
import { useLocale, useT, type TFunction } from '@/lib/i18n'
import type { ResolvedAddress } from './places-api'
import { cn } from '@/lib/utils'
import { EMPTY_COORDINATES, formatCoordinate, parseCoordinates, type CoordinateText, type ParsedCoordinates } from './coordinates'
import { goongMapTilesKey } from './map-style'
import { PlaceSearchBox } from './PlaceSearchBox'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/Dialog'

const CoordinatePickerMap = lazy(() => import('./CoordinatePickerMap'))

/** jsdom và trình duyệt tắt WebGL không có lớp này: khi đó không tải chunk MapLibre (như `RouteMap`). */
const HAS_WEBGL = typeof WebGLRenderingContext !== 'undefined'

/** Câu lỗi của ô `field`, hoặc `undefined` khi ô đó không sai. */
function errorOf(parsed: ParsedCoordinates, field: 'lat' | 'lng', t: TFunction): string | undefined {
  if (parsed.kind !== 'error' || parsed.field !== field) return undefined
  return t(`map.picker.errors.${parsed.code}.${field}`)
}

/**
 * Ô chọn toạ độ dùng chung (FE-4b-03, D-72) — yêu cầu giao, điểm giao thêm tay, kho xuất phát. Ba lối, cùng ghi vào hai ô vĩ độ / kinh
 * độ (mono): chọn từ danh sách địa danh mẫu (`PlaceSearchBox`), gõ tay, và — chỉ khi có khoá map tiles của Goong và có WebGL — bấm lên
 * bản đồ. Không có khoá thì chỉ còn danh sách và hai ô gõ. Giá trị sai báo lỗi **tại ô** sau khi con trỏ rời nhóm ô, hoặc ngay khi
 * form đã bấm lưu (`showErrors`); form chặn lưu bằng cùng `parseCoordinates`. `disabled`: chỉ xem toạ độ đang có.
 */
export function CoordinatePicker({ label, value, onChange, onPlacePicked, disabled = false, showErrors = false, hint, className }: {
  label: string
  value: CoordinateText
  onChange: (next: CoordinateText) => void
  /** Người dùng vừa chọn một địa danh từ danh sách — form có thể điền sẵn địa chỉ. */
  onPlacePicked?: (place: ResolvedAddress) => void
  disabled?: boolean
  showErrors?: boolean
  hint?: string
  className?: string
}) {
  const t = useT()
  const { locale } = useLocale()
  const legendId = useId()
  const [touched, setTouched] = useState(false)
  const [mapUnavailable, setMapUnavailable] = useState(false)
  const [picked, setPicked] = useState<{ name: string; lat: string; lng: string } | null>(null)
  const parsed = parseCoordinates(value.lat, value.lng)
  const shown: ParsedCoordinates = touched || showErrors ? parsed : { kind: 'empty' }
  const apiKey = goongMapTilesKey()
  const withMap = !disabled && HAS_WEBGL && !mapUnavailable && apiKey !== undefined
  const hasValue = value.lat !== '' || value.lng !== ''
  // Tên địa danh chỉ còn đúng khi hai ô vẫn là toạ độ của nó
  const pickedName = picked && picked.lat === value.lat && picked.lng === value.lng ? picked.name : null
  const [mapExpanded, setMapExpanded] = useState(false)
function handlePick(place: ResolvedAddress) {
  const next = {
    lat: formatCoordinate(place.lat),
    lng: formatCoordinate(place.lng),
  }

  setPicked({ name: place.name, ...next })
  onChange(next)
  onPlacePicked?.(place)
}

  function handleBlur(event: FocusEvent<HTMLFieldSetElement>) {
    if (!event.currentTarget.contains(event.relatedTarget)) setTouched(true)
  }

  return (
    <fieldset aria-labelledby={legendId} onBlur={handleBlur} className={cn('m-0 flex min-w-0 flex-col gap-2 border-0 p-0', className)}>
      <legend id={legendId} className={cn(fieldLabelClass, 'mb-1.5 p-0')}>{label}</legend>
      {disabled ? null : <PlaceSearchBox onPick={handlePick} />}
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-start gap-2">
        <Input
          label={t('map.picker.lat')}
          inputMode="decimal"
          autoComplete="off"
          readOnly={disabled}
          className="font-mono tabular-nums"
          value={value.lat}
          error={errorOf(shown, 'lat', t)}
          onChange={(event) => onChange({ ...value, lat: event.target.value })}
        />
        <Input
          label={t('map.picker.lng')}
          inputMode="decimal"
          autoComplete="off"
          readOnly={disabled}
          className="font-mono tabular-nums"
          value={value.lng}
          error={errorOf(shown, 'lng', t)}
          onChange={(event) => onChange({ ...value, lng: event.target.value })}
        />
        {disabled ? null : (
          // Cao bằng nhãn + ô: nút nằm ngang hàng với hai ô nhập
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="mt-6 size-10 text-ink-3"
            aria-label={t('map.picker.clear')}
            title={t('map.picker.clear')}
            disabled={!hasValue}
            onClick={() => { setPicked(null); onChange(EMPTY_COORDINATES) }}
          >
            <X strokeWidth={1.75} />
          </Button>
        )}
      </div>
      {pickedName ? <p role="status" className="text-fine text-ink-2">{t('map.picker.picked', { name: pickedName })}</p> : null}
      {withMap ? (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setMapExpanded(true)}
          >
            <Maximize2 className="size-4" />
            {t('map.picker.expand')}
          </Button>
        </div>
      ) : null}
      {withMap ? (
        <Suspense fallback={null}>
          <CoordinatePickerMap
            key={locale}
            apiKey={apiKey}
            value={parsed.kind === 'ok' ? { lat: parsed.lat, lng: parsed.lng } : null}
            onPick={(point) => { setPicked(null); onChange({ lat: formatCoordinate(point.lat), lng: formatCoordinate(point.lng) }) }}
            onUnavailable={() => setMapUnavailable(true)}
          />
        </Suspense>
      ) : null}
      {disabled ? null : <p className="text-fine text-ink-3">{hint ?? (withMap ? t('map.picker.hintMap') : t('map.picker.hint'))}</p>}

      {withMap ? (
        <Dialog open={mapExpanded} onOpenChange={setMapExpanded}>
          <DialogContent className="flex h-[85dvh] w-[95vw] max-w-6xl flex-col overflow-hidden p-4">
            <div className="shrink-0">
              <h2 className="text-lg font-semibold">
                {t('map.picker.expand')}
              </h2>
              <p className="text-sm text-ink-3">
                {t('map.picker.hintMap')}
              </p>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg">
              <Suspense fallback={null}>
                <CoordinatePickerMap
                  key={`expanded-${locale}`}
                  apiKey={apiKey!}
                  heightClassName="h-full min-h-0 flex-1"
                  value={
                    parsed.kind === 'ok'
                      ? { lat: parsed.lat, lng: parsed.lng }
                      : null
                  }
                  onPick={(point) => {
                    setPicked(null)
                    onChange({
                      lat: formatCoordinate(point.lat),
                      lng: formatCoordinate(point.lng),
                    })
                    setMapExpanded(false)
                  }}
                  onUnavailable={() => {
                    setMapUnavailable(true)
                    setMapExpanded(false)
                  }}
                />
              </Suspense>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </fieldset>
  )
}
