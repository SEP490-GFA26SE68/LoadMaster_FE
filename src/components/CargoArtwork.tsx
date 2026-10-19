import { useEffect, useId, useMemo, useState } from 'react'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import {
  boxFaces,
  containerShell,
  createProjector,
  fitViewBox,
  groundShadow,
  roofOutline,
  shellColors,
  sortByDepth,
} from '@/lib/isometric'
import { cn } from '@/lib/utils'
import { ARTWORK_CONTAINER, artworkBoxes } from './cargo-artwork-boxes'

const SCALE = 64
/** Lề trong khung nhìn, chừa chỗ cho bóng đổ mềm khỏi bị cắt thành cạnh thẳng. */
const PAD = 36

/** Nhịp thả một kiện. Đây là hoạt ảnh trang trí, không phải điều khiển phát lại
 *  ở màn phương án (mục 8 quy định 400–700ms cho thao tác đó). Cả thùng xếp xong trong khoảng 4 giây. */
const STEP_MS = 70

/**
 * Hình minh hoạ thùng xe tự xếp đầy một lần rồi đứng yên ở trạng thái đầy — màn đăng nhập và trang giới thiệu (màn không có dữ liệu,
 * AGENTS.md mục 5), đặt trên nền tối. Không lặp: hình chuyển động mãi bên cạnh chữ làm phân tán người đọc, và không có nút dừng nào
 * (WCAG 2.2.2). Người chọn giảm chuyển động thấy ngay thùng đầy. Thứ tự thả đúng trình tự xếp thật — từ vách trước ra cửa sau, lớp dưới trước lớp trên — nên nó minh hoạ luôn nguyên tắc
 * LIFO của sản phẩm. `label` là tên truy cập của hình (nơi dùng dịch sẵn); `className` đặt cỡ — mặc định chặn chiều cao để trên laptop
 * màn thấp, hình không đẩy phần chữ bên dưới ra ngoài vùng nhìn thấy.
 */
export function CargoArtwork({ label, className }: { label: string; className?: string }) {
  const reducedMotion = usePrefersReducedMotion()
  // Mã bộ lọc SVG riêng cho từng hình (hai hình trên một trang không giành nhau); bỏ ký tự lạ của `useId` khỏi `url(#…)`
  const svgId = `lm-cargo-${useId().replace(/[^\w-]/g, '')}`

  const { frame, project, shell, roof, shadow, boxes } = useMemo(() => {
    // Khung nhìn tính từ kích thước thùng, không đặt tay — xem `fitViewBox`.
    const frame = fitViewBox(ARTWORK_CONTAINER, SCALE, PAD)
    const projector = createProjector(SCALE, frame.offsetX, frame.offsetY)
    return {
      frame,
      project: projector,
      shell: containerShell(ARTWORK_CONTAINER, projector, shellColors()),
      roof: roofOutline(ARTWORK_CONTAINER, projector),
      shadow: groundShadow(ARTWORK_CONTAINER, projector),
      // Thứ tự xếp: vách trước → cửa sau, lớp dưới → lớp trên.
      boxes: artworkBoxes().sort(
        (a, b) => a.x - b.x || a.z - b.z || a.y - b.y,
      ),
    }
  }, [])

  // Số kiện đã thả: mỗi nhịp thêm một kiện, đủ thùng thì dừng hẳn. Không gọi setState đồng bộ trong effect.
  const [tick, setTick] = useState(0)
  const revealed = reducedMotion ? boxes.length : Math.min(tick, boxes.length)

  useEffect(() => {
    if (reducedMotion || tick >= boxes.length) return
    const timer = window.setTimeout(() => setTick((previous) => previous + 1), STEP_MS)
    return () => window.clearTimeout(timer)
  }, [reducedMotion, tick, boxes.length])

  const faces = useMemo(
    () =>
      sortByDepth([
        ...shell,
        ...boxes
          .slice(0, revealed)
          .flatMap((box) => boxFaces(box, project, { strokeWidth: 0.5, topTint: 0.08 })),
      ]),
    [shell, boxes, revealed, project],
  )

  return (
    <svg
      viewBox={frame.viewBox}
      preserveAspectRatio="xMidYMid meet"
      className={cn('block max-h-[38vh] w-full', className)}
      role="img"
      aria-label={label}
    >
      <defs>
        <filter id={`${svgId}-blur`} x="-30%" y="-60%" width="160%" height="240%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
        <radialGradient id={`${svgId}-glow`} cx="50%" cy="50%" r="55%">
          <stop offset="0" stopColor="#ffffff" stopOpacity=".08" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width={frame.width} height={frame.height} fill={`url(#${svgId}-glow)`} />

      <polygon points={shadow} fill="#000" opacity={0.55} filter={`url(#${svgId}-blur)`} />
      {faces.map((face, index) => (
        <polygon
          key={index}
          points={face.points}
          fill={face.fill}
          stroke={face.stroke}
          strokeWidth={face.strokeWidth}
          strokeLinejoin="round"
        />
      ))}
      <polyline
        points={roof}
        fill="none"
        stroke="rgba(255,255,255,.3)"
        strokeWidth={1.2}
        strokeDasharray="4 4"
      />
    </svg>
  )
}
