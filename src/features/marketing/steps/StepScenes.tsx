import type { ComponentType } from 'react'
import { IntakeScene } from './IntakeScene'
import { OperateScene } from './OperateScene'
import { OptimizeScene } from './OptimizeScene'
import { DoneScene, PlanScene } from './RouteScenes'

/**
 * Cảnh của khung dính Cách hoạt động theo mục đang đọc — bốn bước của một chuyến rồi câu kết (chuyến đã giao xong). Mỗi cảnh là một hình
 * SVG trang trí (`aria-hidden` theo khung): khung 400 × 220 co giãn giữ tỉ lệ, bốn điểm giao luôn kèm số, không số liệu nào khác ngoài số
 * điểm giao và chữ cái của phương án. `motion`: các mảnh hiện dần một lần khi cảnh vào (`sections.css`); tắt thì hình tĩnh ở trạng thái cuối.
 */
export const STEP_SCENES = [
  { key: 'intake', Scene: IntakeScene },
  { key: 'plan', Scene: PlanScene },
  { key: 'optimize', Scene: OptimizeScene },
  { key: 'operate', Scene: OperateScene },
  { key: 'done', Scene: DoneScene },
] as const satisfies readonly { key: string; Scene: ComponentType<{ motion: boolean }> }[]

export type StepSceneKey = (typeof STEP_SCENES)[number]['key']
