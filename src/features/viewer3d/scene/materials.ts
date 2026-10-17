import { Color } from 'three'
import { readToken } from '@/lib/tokens'

/**
 * Màu vật liệu của thùng xe và đầu kéo, suy ra từ token vùng 3D
 * (`--canvas-*`, `--panel-dark`, `--border-dark`) thay vì hex tự đặt.
 */
export type SceneMaterials = {
  floor: string
  wall: string
  skirt: string
  cab: string
  chassis: string
  wheel: string
  windshield: string
  outline: string
  metal: string
  light: string
  tailLight: string
  /** Đèn cờ, đèn phản quang hông */
  marker: string
}

function derive(token: `--${string}`, fallback: string, factor: number): string {
  const color = new Color(readToken(token) || fallback).multiplyScalar(factor)
  return `#${color.getHexString()}`
}

/**
 * `lift` > 1 làm sáng sàn, vách và gờ thùng: xem trước ở form xe không có kiện nào tô màu bên trong, thùng tối trên nền tối
 * thì không còn nhìn ra hình khối.
 */
export function sceneMaterials(lift = 1): SceneMaterials {
  const info = new Color(readToken('--info') || '#0891b2')
  const bg = new Color(readToken('--bg') || '#ffffff')

  return {
    floor: derive('--border-dark', '#2d323b', 1.55 * lift),
    wall: derive('--border-dark', '#2d323b', 1.25 * lift),
    skirt: derive('--border-dark', '#2d323b', 1.9 * lift),
    cab: derive('--bg', '#ffffff', 0.62),
    chassis: derive('--panel-dark', '#1e2228', 0.9),
    wheel: derive('--canvas-2', '#0f1115', 1.1),
    windshield: `#${info.multiplyScalar(0.24).getHexString()}`,
    outline: derive('--canvas-2', '#0f1115', 1),
    metal: derive('--text-disabled', '#9ca3af', 0.8),
    light: `#${bg.getHexString()}`,
    tailLight: readToken('--danger'),
    marker: readToken('--warning') || '#d97706',
  }
}
