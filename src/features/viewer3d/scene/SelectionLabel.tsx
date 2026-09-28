import { useT } from '@/lib/i18n'
import { SceneCallout } from './SceneCallout'
import { SceneTag } from './SceneTag'
import type { ScenePlacement } from '@/features/viewer3d/scene-input'
import { boxCenter, boxSize } from './units'

/**
 * Nhãn neo trên đỉnh kiện đang chọn / hiện tại / tiếp theo — trường hợp duy nhất mục 7 cho phép dùng `<Html>` của drei, vì nhãn
 * phải bám theo vật thể 3D. Kính tối hai dòng (V2.3): vai trò · điểm giao, rồi mã kiện; "tiếp theo" chỉ một dòng.
 */
export function SelectionLabel({ placement, role = 'selected' }: { placement: ScenePlacement; role?: 'selected' | 'current' | 'next' }) {
  const t = useT()
  const [cx, cy, cz] = boxCenter(placement)
  const [, height] = boxSize(placement)

  return (
    <SceneCallout
      position={[cx, cy + height / 2, cz]}
      offset={role === 'next' ? [110, -24] : role === 'current' ? [-90, -80] : [0, -100]}
      width={role === 'next' ? 180 : 168}
      anchor={role !== 'next'}
    >
      <SceneTag tone={role} title={t(`viewer.selectionLabel.${role}`, { stop: placement.stop })} code={role !== 'next' ? placement.id : undefined} />
    </SceneCallout>
  )
}
