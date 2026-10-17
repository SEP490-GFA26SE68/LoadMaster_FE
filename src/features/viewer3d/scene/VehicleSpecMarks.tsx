import { Html, Line } from '@react-three/drei'
import { useMemo, type ReactNode } from 'react'
import { Color } from 'three'
import type { VehicleConfig } from '@/domain/models'
import { useFormat, useT } from '@/lib/i18n'
import { readToken } from '@/lib/tokens'
import { cn } from '@/lib/utils'
import { SceneTag, type SceneTagTone } from './SceneTag'
import type { Vec3 } from './units'
import { vehicleSpecMarks, type SpecLabel, type SpecMarkRole } from './vehicle-spec-marks'

const NO_RAYCAST = () => null
const NONE: readonly SpecLabel[] = []
const ROLE_TOKEN: Record<SpecMarkRole, `--${string}`> = { dimension: '--cyan-300', door: '--bg', axle: '--n-400' }
/** Nhãn số đo gọn hơn nhãn kiện của Planner: khung xem trước nhỏ, năm tới bảy nhãn cùng lúc. */
const TAG = 'px-1.5 py-0.5 xl:text-micro'

/**
 * Số đang nhập vẽ lên mô hình ở form xe: đường kích thước dài · rộng · cao của lòng thùng, viền ô cửa sau đúng rộng × cao, và vị trí
 * từng trục đã khai đo từ vách trước. Mọi đoạn thẳng nằm trong **một** `Line` tô màu theo đỉnh (một draw call dù xe có mấy trục);
 * nhãn là DOM neo vào điểm giữa đường. Chữ và số tính ở đây rồi mới đưa vào `<Html>` — bên trong `<Html>` không có context của app.
 * `hidden`: nhãn tạm ẩn ở góc nhìn đang chọn (đường vẫn vẽ).
 */
export function VehicleSpecMarks({ vehicle, hidden = NONE }: { vehicle: VehicleConfig; hidden?: readonly SpecLabel[] }) {
  const t = useT()
  const format = useFormat()
  const marks = useMemo(() => vehicleSpecMarks(vehicle), [vehicle])
  const { points, colors } = useMemo(() => {
    const tint = (role: SpecMarkRole) => new Color(readToken(ROLE_TOKEN[role]) || '#ffffff')
    const byRole: Record<SpecMarkRole, Color> = { dimension: tint('dimension'), door: tint('door'), axle: tint('axle') }
    return {
      points: marks.segments.flatMap((segment) => [segment.from, segment.to]),
      colors: marks.segments.flatMap((segment) => [byRole[segment.role], byRole[segment.role]]),
    }
  }, [marks])
  const shown = (label: SpecLabel) => !hidden.includes(label)

  return <group name="vehicle-spec-marks">
    <Line points={points} vertexColors={colors} segments lineWidth={1.5} raycast={NO_RAYCAST} />
    {shown('length') ? (
      <Mark position={marks.anchors.length} tone="next" data="length">{t('viewer.spec.length', { value: format.length(vehicle.innerLengthCm) })}</Mark>
    ) : null}
    {shown('width') ? (
      <Mark position={marks.anchors.width} tone="next" data="width">{t('viewer.spec.width', { value: format.length(vehicle.innerWidthCm) })}</Mark>
    ) : null}
    {shown('height') ? (
      <Mark position={marks.anchors.height} tone="next" data="height">{t('viewer.spec.height', { value: format.length(vehicle.innerHeightCm) })}</Mark>
    ) : null}
    {shown('door') ? (
      <Mark position={marks.anchors.door} tone="selected" data="door">
        {t('viewer.spec.door', { size: format.widthByHeight(vehicle.doorWidthCm, vehicle.doorHeightCm) })}
      </Mark>
    ) : null}
    {(shown('axles') ? marks.axles : []).map((axle) => (
      <Mark key={axle.id} position={axle.anchor} data="axle" className={axle.tier === 0 ? 'translate-y-1' : 'translate-y-7'} below>
        {format.length(axle.positionXCm)}
      </Mark>
    ))}
  </group>
}

function Mark({ position, tone = 'plain', data, below = false, className, children }: {
  position: Vec3; tone?: SceneTagTone; data: string; below?: boolean; className?: string; children: ReactNode
}) {
  return <Html position={position} zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
    <span data-spec-mark={data} className={cn('block w-max -translate-x-1/2', below ? className : '-translate-y-1/2')}>
      <SceneTag tone={tone} mono title={children} className={TAG} />
    </span>
  </Html>
}
