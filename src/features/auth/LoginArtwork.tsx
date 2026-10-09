import { useEffect, useMemo, useState } from 'react'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { useT } from '@/lib/i18n'
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
import { ARTWORK_CONTAINER, artworkBoxes } from './login-artwork-boxes'

const SCALE = 64
/** Lề trong khung nhìn, chừa chỗ cho bóng đổ mềm khỏi bị cắt thành cạnh thẳng. */
const PAD = 36

/** Nhịp thả một kiện. Đây là hoạt ảnh trang trí, không phải điều khiển phát lại
 *  ở màn phương án (mục 8 quy định 400–700ms cho thao tác đó). */
const STEP_MS = 70
/** Giữ thùng đầy bao lâu trước khi lặp lại, tính theo số nhịp.
 *  Để dài hơn lúc lấp, vì trạng thái đầy mới là hình cần nhìn. */
const HOLD_STEPS = 80

/**
 * Hình minh hoạ cột phải màn đăng nhập: thùng xe tự xếp đầy rồi lặp lại.
 * Thứ tự thả đúng trình tự xếp thật — từ vách trước ra cửa sau, lớp dưới
 * trước lớp trên — nên nó minh hoạ luôn nguyên tắc LIFO của sản phẩm.
 */
export function LoginArtwork() {
  const t = useT()
  const reducedMotion = usePrefersReducedMotion()

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

  // Bộ đếm chạy vòng: phần đầu là lúc thả từng kiện, phần đuôi là lúc giữ
  // thùng đầy. Không gọi setState đồng bộ trong effect.
  const [tick, setTick] = useState(0)
  const revealed = reducedMotion ? boxes.length : Math.min(tick, boxes.length)

  useEffect(() => {
    if (reducedMotion) return
    const cycle = boxes.length + HOLD_STEPS
    const id = window.setInterval(() => setTick((previous) => (previous + 1) % cycle), STEP_MS)
    return () => window.clearInterval(id)
  }, [reducedMotion, boxes.length])

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
      // Chặn chiều cao để trên laptop màn thấp, hình không đẩy phần chữ bên
      // dưới ra ngoài vùng nhìn thấy (cột phải có `overflow-hidden`).
      className="block max-h-[38vh] w-full"
      role="img"
      aria-label={t('auth.showcase.artworkLabel')}
    >
      <defs>
        <filter id="lm-login-blur" x="-30%" y="-60%" width="160%" height="240%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
        <radialGradient id="lm-login-glow" cx="50%" cy="50%" r="55%">
          <stop offset="0" stopColor="#ffffff" stopOpacity=".08" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width={frame.width} height={frame.height} fill="url(#lm-login-glow)" />

      <polygon points={shadow} fill="#000" opacity={0.55} filter="url(#lm-login-blur)" />
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

