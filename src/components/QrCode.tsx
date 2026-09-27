import { useMemo } from 'react'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { qrPath } from './qr-matrix'

/**
 * Mã QR của kiện hoặc chuyến (LM-104): một `<svg>` với đúng một `<path>` cho mọi module tối, vùng yên lặng 4 module, mức sửa lỗi M.
 * `viewBox` tính bằng module và `crispEdges` nên hình sắc ở mọi cỡ, in ra giấy vẫn quét được. Nền trắng `--bg`, module theo màu
 * chữ (`currentColor`). `showToken` in mã dưới hình để người không có máy quét gõ tay.
 */
export function QrCode({
  token,
  size = 160,
  label,
  showToken = false,
  className,
}: {
  token: string
  /** Cạnh của hình, px. */
  size?: number
  /** Tên truy cập; mặc định "Mã QR <token>". */
  label?: string
  showToken?: boolean
  className?: string
}) {
  const t = useT()
  const path = useMemo(() => qrPath(token), [token])

  return (
    <div className={cn('inline-flex flex-col items-center gap-1.5', className)}>
      <svg
        role="img"
        aria-label={label ?? t('qr.imageLabel', { token })}
        width={size}
        height={size}
        viewBox={`0 0 ${path.size} ${path.size}`}
        shapeRendering="crispEdges"
        className="block bg-bg text-text"
      >
        <path d={path.d} fill="currentColor" />
      </svg>
      {showToken ? <span className="font-mono text-small text-ink-2 tabular-nums">{token}</span> : null}
    </div>
  )
}
