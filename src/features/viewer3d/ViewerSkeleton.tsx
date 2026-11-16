import { useMemo } from 'react'
import { Skeleton } from '@/components/ui/Skeleton'
import { useFormat, useT } from '@/lib/i18n'
import { createProjector, roofOutline, groundShadow, type IsoSize } from '@/lib/isometric'

const SCALE = 30
const CONTAINER: IsoSize = { length: 7.2, width: 2.35, height: 2.4 }
const COLUMN_COUNT = 8
const ROWS: Array<[y: number, width: number]> = [
  [0.1, 1.0],
  [1.25, 1.0],
]

/**
 * Giữ chỗ trong lúc tải chunk Three.js: thùng xe và kiện hàng dạng bóng
 * mờ nhấp nháy lệch pha, kèm khung giữ chỗ cho các panel nổi.
 */
export function ViewerSkeleton({
  packageCount,
  stopCount,
}: {
  packageCount: number
  stopCount: number
}) {
  const t = useT()
  const format = useFormat()
  const scene = useMemo(() => {
    const project = createProjector(SCALE)
    const { length: l, width: w, height: h } = CONTAINER
    const faces: Array<{ points: string; fill: string; delay: string }> = [
      { points: [project(0, 0, 0), project(l, 0, 0), project(l, w, 0), project(0, w, 0)].join(' '), fill: 'rgba(255,255,255,.10)', delay: '0s' },
      { points: [project(0, 0, 0), project(0, w, 0), project(0, w, h), project(0, 0, h)].join(' '), fill: 'rgba(255,255,255,.07)', delay: '0s' },
      { points: [project(0, 0, 0), project(l, 0, 0), project(l, 0, h), project(0, 0, h)].join(' '), fill: 'rgba(255,255,255,.08)', delay: '0s' },
    ]
    let x = 0.1
    for (let ci = 0; ci < COLUMN_COUNT; ci++) {
      ROWS.forEach(([y, bw], ri) => {
        const bl = 0.8
        const bh = 1.0
        const delay = `${((ci + ri) * 0.12).toFixed(2)}s`
        faces.push(
          { points: [project(x, y + bw, 0), project(x + bl, y + bw, 0), project(x + bl, y + bw, bh), project(x, y + bw, bh)].join(' '), fill: 'rgba(255,255,255,.10)', delay },
          { points: [project(x + bl, y, 0), project(x + bl, y + bw, 0), project(x + bl, y + bw, bh), project(x + bl, y, bh)].join(' '), fill: 'rgba(255,255,255,.14)', delay },
          { points: [project(x, y, bh), project(x + bl, y, bh), project(x + bl, y + bw, bh), project(x, y + bw, bh)].join(' '), fill: 'rgba(255,255,255,.20)', delay },
        )
      })
      x += 0.88
    }
    return { faces, roof: roofOutline(CONTAINER, project), shadow: groundShadow(CONTAINER, project) }
  }, [])

  return (
    <div role="status" aria-label={t('viewer.skeleton.label')} className="absolute inset-0">
      <div className="absolute top-4 left-4 flex gap-0.5 rounded-md bg-white/6 p-1">
        <Skeleton dark className="h-7 w-13 rounded-sm" />
        <Skeleton dark className="h-7 w-16 rounded-sm" style={{ animationDelay: '.15s' }} />
        <Skeleton dark className="h-7 w-18 rounded-sm" style={{ animationDelay: '.3s' }} />
      </div>
      <Skeleton dark className="absolute top-4 right-4 h-24 w-50 rounded-md" style={{ animationDelay: '.2s' }} />

      <svg viewBox="0 0 640 400" preserveAspectRatio="xMidYMid meet" className="block h-full w-full" aria-hidden>
        <defs>
          <filter id="lm-sk-blur" x="-30%" y="-60%" width="160%" height="240%">
            <feGaussianBlur stdDeviation="10" />
          </filter>
        </defs>
        <g transform="translate(300,196)">
          <polygon points={scene.shadow} fill="var(--cyan-950)" opacity={0.5} filter="url(#lm-sk-blur)" />
          {scene.faces.map((face, index) => (
            <polygon
              key={index}
              points={face.points}
              fill={face.fill}
              stroke="rgba(255,255,255,.12)"
              strokeWidth={0.8}
              strokeLinejoin="round"
              className="animate-[lm-pulse_1.8s_ease-in-out_infinite]"
              style={{ animationDelay: face.delay }}
            />
          ))}
          <polyline points={scene.roof} fill="none" stroke="rgba(255,255,255,.22)" strokeWidth={1} strokeDasharray="3 3" />
        </g>
      </svg>

      <div className="absolute right-0 bottom-5 left-0 flex flex-col items-center gap-2">
        <span className="text-body font-medium text-white/75">{t('viewer.skeleton.text')}</span>
        <span className="font-mono text-caption text-white/45">
          {t('viewer.skeleton.counts', { packages: format.integer(packageCount), stops: format.integer(stopCount) })}
        </span>
      </div>
    </div>
  )
}
