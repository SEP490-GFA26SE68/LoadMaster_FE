import type { VehicleObstacle } from '@/domain/models'
import { useObstacleText } from '../overlays/useObstacleText'
import { SceneCallout } from './SceneCallout'
import { SceneTag } from './SceneTag'
import { obstacleCenter, obstacleSize } from './units'

/** Thông tin vật cản vừa bấm, neo trên đỉnh vật cản (LM-033): loại, mã, góc, kích thước cm, chịu tải. */
export function ObstacleCallout({ obstacle }: { obstacle: VehicleObstacle }) {
  const text = useObstacleText()
  const [cx, cy, cz] = obstacleCenter(obstacle)
  const [, height] = obstacleSize(obstacle)
  return <SceneCallout position={[cx, cy + height / 2, cz]} offset={[0, -110]} width={240} anchor>
    <span data-obstacle-callout={obstacle.id} className="inline-block">
      <SceneTag tone="plain" title={<>{text.type(obstacle)} · <span className="font-mono">{obstacle.id}</span></>}>
        <span className="font-mono">{text.size(obstacle)}</span>
        <span className="font-mono">{text.corner(obstacle)}</span>
        <span>{text.bearing(obstacle)}</span>
      </SceneTag>
    </span>
  </SceneCallout>
}
