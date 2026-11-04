import { ARTWORK_CONTAINER, artworkBoxesInLoadingOrder } from '@/components/cargo-artwork-boxes'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { boxFacePoints, createProjector, fitViewBox, roofOutline, shellFacePoints, type IsoBoxFacePoints } from '@/lib/isometric'
import { cn } from '@/lib/utils'
import { revealedBoxCount } from './run-progress'

const SCALE = 24
const PAD = 4

const FRAME = fitViewBox(ARTWORK_CONTAINER, SCALE, PAD)
const PROJECT = createProjector(SCALE, FRAME.offsetX, FRAME.offsetY)
const SHELL = shellFacePoints(ARTWORK_CONTAINER, PROJECT, 0.2)
const ROOF = roofOutline(ARTWORK_CONTAINER, PROJECT)

type FigureBox = { readonly order: number; readonly depth: number; readonly faces: IsoBoxFacePoints }

/** Khối theo trình tự xếp — vách trước ra cửa sau, lớp dưới trước lớp trên —, thứ tự hiện ra của hình. Bỏ màu điểm giao của hình gốc. */
const BOXES: readonly FigureBox[] = artworkBoxesInLoadingOrder().map((box, order) => ({
  order, depth: box.x + box.y + box.z, faces: boxFacePoints(box, PROJECT),
}))
/** Cùng các khối đó theo thứ tự vẽ: xa trước, gần sau. */
const DRAW_ORDER = BOXES.toSorted((a, b) => a.depth - b.depth)

/** Chu kỳ của chế độ không xác định (`lm-run-wave` 3,6 s): mỗi khối bắt đầu sau khối trước một phần N chu kỳ. */
const WAVE_MS = 3600

/**
 * Thùng xe đẳng cự của hộp thoại chạy tối ưu (SVG, không Three.js — AGENTS mục 7), các khối hiện dần bên trong theo **phần việc thật**
 * đã xong: `fraction` là `checked / workload` của service, số khối hiện ra là `revealedBoxCount` — không tự chạy trước tiến trình, không
 * có số nào trên hình. Khối không phải kiện thật hay phương án nào: chỉ là phần công việc.
 *
 * `fraction: null` (chưa có sự kiện tiến trình, hoặc nguồn không báo số): một dải khối chạy vòng từ vách trước ra cửa sau, không dừng ở mức
 * nào. Giảm chuyển động: không hoạt ảnh — hình đứng ở mức hiện tại, chế độ không xác định là thùng rỗng đứng yên.
 * Màu từ token: khối thang azure ("đang chạy"), vỏ thùng xám ánh cyan; tám màu điểm giao không dùng ở đây. `aria-hidden`: trình đọc màn
 * hình đọc thanh tiến trình và các dòng chữ của hộp thoại.
 */
export function RunFigure({ fraction, className }: { fraction: number | null; className?: string }) {
  const reducedMotion = usePrefersReducedMotion()
  const revealed = revealedBoxCount(fraction, BOXES.length)
  const shown = DRAW_ORDER.filter((box) => (revealed === null ? !reducedMotion : box.order < revealed))
  const animation = reducedMotion
    ? undefined
    : revealed === null
      ? 'animate-[lm-run-wave_3.6s_linear_infinite_both]'
      : 'animate-[lm-box-in_var(--dur-md)_var(--ease-decelerate)_both]'

  return (
    <svg
      aria-hidden
      viewBox={FRAME.viewBox}
      preserveAspectRatio="xMidYMid meet"
      data-run-figure={revealed === null ? 'indeterminate' : 'determinate'}
      className={cn('block', className)}
    >
      <g strokeWidth={0.8} strokeLinejoin="round" className="stroke-n-400">
        <polygon points={SHELL.floor} className="fill-n-100" />
        <polygon points={SHELL.farWall} className="fill-n-200" />
        <polygon points={SHELL.sideWall} className="fill-n-100" />
      </g>
      <g strokeWidth={0.6} strokeLinejoin="round" className="stroke-azure-700">
        {shown.map((box) => (
          <g
            key={box.order}
            data-run-box=""
            className={animation}
            style={revealed === null && animation ? { animationDelay: `${Math.round((box.order * WAVE_MS) / BOXES.length)}ms` } : undefined}
          >
            <polygon points={box.faces.left} className="fill-azure-700" />
            <polygon points={box.faces.right} className="fill-azure-500" />
            <polygon points={box.faces.top} className="fill-azure-200" />
          </g>
        ))}
      </g>
      <polygon points={SHELL.skirt} strokeWidth={0.6} strokeLinejoin="round" className="fill-n-300 stroke-n-400" />
      <polyline points={ROOF} fill="none" strokeWidth={0.8} strokeDasharray="3 3" className="stroke-n-400" />
    </svg>
  )
}
