
import { useId } from 'react'
import type { VehicleType } from './vehicle-types-api'

type Props = {
    vehicleType: VehicleType
}

export function VehicleTypeMiniPreview({
    vehicleType,
}: Props) {
    const patternId = useId()

    const length = vehicleType.cargoLengthCm
    const width = vehicleType.cargoWidthCm

    if (
        !Number.isFinite(length) ||
        !Number.isFinite(width) ||
        length <= 0 ||
        width <= 0
    ) {
        return (
            <span className="text-small text-ink-3">
                —
            </span>
        )
    }

    const obstacles = vehicleType.obstacles ?? []

    // Kích thước vùng vẽ SVG
    const viewWidth = 180
    const viewHeight = 76
    const padding = 7

    const availableWidth = viewWidth - padding * 2
    const availableHeight = viewHeight - padding * 2

    // Giữ tỷ lệ thật của lòng thùng
    const scale = Math.min(
        availableWidth / length,
        availableHeight / width,
    )

    const boxWidth = length * scale
    const boxHeight = width * scale

    const offsetX = (viewWidth - boxWidth) / 2
    const offsetY = (viewHeight - boxHeight) / 2

    return (
        <div
            className="w-fit rounded-lg border border-border bg-surface px-2 py-1.5"
            title={`${length} × ${width} × ${vehicleType.cargoHeightCm} cm`}
        >
            <svg
                viewBox={`0 0 ${viewWidth} ${viewHeight}`}
                width={180}
                height={76}
                role="img"
                aria-label={`Sơ đồ lòng thùng ${length} × ${width} cm`}
                className="block max-w-full"
            >
                <defs>
                    <pattern
                        id={patternId}
                        width="7"
                        height="7"
                        patternUnits="userSpaceOnUse"
                    >
                        <path
                            d="M 7 0 L 0 0 0 7"
                            fill="none"
                            stroke="currentColor"
                            strokeOpacity="0.08"
                            strokeWidth="0.6"
                        />
                    </pattern>
                </defs>

                {/* Nền lòng thùng */}
                <rect
                    x={offsetX}
                    y={offsetY}
                    width={boxWidth}
                    height={boxHeight}
                    rx={2}
                    fill="#E7F5F7"
                    stroke="#0F7180"
                    strokeWidth={1.6}
                />

                {/* Lưới nền */}
                <rect
                    x={offsetX}
                    y={offsetY}
                    width={boxWidth}
                    height={boxHeight}
                    fill={`url(#${patternId})`}
                />

                {/* Vật cản */}
                {obstacles.map((obstacle, index) => {
                    const x = Number(obstacle.x)
                    const y = Number(obstacle.y)
                    const obstacleLength = Number(obstacle.length)
                    const obstacleWidth = Number(obstacle.width)

                    if (
                        ![x, y, obstacleLength, obstacleWidth]
                            .every(Number.isFinite) ||
                        obstacleLength <= 0 ||
                        obstacleWidth <= 0
                    ) {
                        return null
                    }

                    return (
                        <rect
                            key={obstacle.id ?? index}
                            x={offsetX + x * scale}
                            y={offsetY + y * scale}
                            width={obstacleLength * scale}
                            height={obstacleWidth * scale}
                            fill="#F59E0B"
                            fillOpacity={0.75}
                            stroke="#B45309"
                            strokeWidth={0.7}
                        />
                    )
                })}

                {/* Mép cửa sau (quy ước x = 0) */}
                <line
                    x1={offsetX}
                    y1={offsetY}
                    x2={offsetX}
                    y2={offsetY + boxHeight}
                    stroke="#06B6D4"
                    strokeWidth={3}
                    strokeLinecap="round"
                />
            </svg>
        </div>
    )
}
