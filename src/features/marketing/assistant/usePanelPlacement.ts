import { useCallback, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from 'react'
import { useT } from '@/lib/i18n'
import type { AssistantSurface } from './assistant-api'
import { assistantSession } from './assistant-session'
import {
  fitPlacement,
  nudgePosition,
  PANEL_STEP,
  PANEL_STEP_LARGE,
  placementOf,
  snapPosition,
  clampPosition,
  type PanelBounds,
  type PanelPlacement,
  type PanelPoint,
} from './panel-position'
import type { AssistantDock } from './useAssistantLauncher'

/** Kéo quá chừng này (px) mới tính là kéo: bấm đầu khung không dời khung. */
const DRAG_THRESHOLD = 4
const REM = 16

/** Đỉnh khung không lên trên dòng này: đáy đầu trang công khai (4 rem), thanh điều hướng (60 px), thanh trên Planner, thanh dải trời — cộng khe 8 px. */
function topInsetOf(surface: AssistantSurface, dock: AssistantDock | undefined): number {
  if (dock === 'planner') return 5 * REM
  if (dock === 'touch') {
    const bar = Number.parseFloat(document.documentElement.style.getPropertyValue('--assistant-touch-top'))
    return (Number.isFinite(bar) ? bar : 5 * REM) + 0.5 * REM
  }
  return surface === 'app' ? 3.75 * REM + 0.5 * REM : 4.5 * REM
}

function boundsOf(surface: AssistantSurface, dock: AssistantDock | undefined): PanelBounds {
  const root = document.documentElement
  return {
    viewport: { width: root.clientWidth || window.innerWidth, height: root.clientHeight || window.innerHeight },
    topInset: topInsetOf(surface, dock),
  }
}

const sizeOf = (el: HTMLElement) => ({ width: el.offsetWidth, height: el.offsetHeight })

function writePlacement(el: HTMLElement, placement: PanelPlacement | null) {
  el.style.left = placement?.x === 'left' ? `${placement.dx}px` : placement ? 'auto' : ''
  el.style.right = placement?.x === 'right' ? `${placement.dx}px` : placement ? 'auto' : ''
  el.style.top = placement?.y === 'top' ? `${placement.dy}px` : placement ? 'auto' : ''
  el.style.bottom = placement?.y === 'bottom' ? `${placement.dy}px` : placement ? 'auto' : ''
}

function writePoint(el: HTMLElement, point: PanelPoint) {
  el.style.left = `${point.left}px`
  el.style.top = `${point.top}px`
  el.style.right = 'auto'
  el.style.bottom = 'auto'
}

type Drag = { pointerId: number; x: number; y: number; origin: PanelPoint; moving: boolean }

/**
 * Kéo thả và dời bằng phím khung chat (từ 768 px, khung không modal). Chỗ mặc định là của CSS (`assistant.css`); người dùng dời thì vị trí
 * ghi thẳng vào `style` của khung — trong lúc kéo không qua state React mỗi lần di chuột, thả tay mới lưu vào phiên trò chuyện
 * (`assistantSession.placement`). Vị trí đã lưu được kẹp lại vào khung nhìn khi mở khung, đổi cỡ cửa sổ, phóng to / thu nhỏ. Dưới 768 px
 * (tờ phủ cả màn) không có gì để dời: `style` về rỗng.
 */
export function usePanelPlacement({ contentRef, phone, placement, expanded, surface, dock }: {
  contentRef: RefObject<HTMLDivElement | null>
  phone: boolean
  placement: PanelPlacement | null
  expanded: boolean
  surface: AssistantSurface
  dock: AssistantDock | undefined
}) {
  const t = useT()
  const gripRef = useRef<HTMLButtonElement>(null)
  const drag = useRef<Drag | null>(null)
  const [announcement, setAnnouncement] = useState('')
  // Khung chỉ có trong DOM khi mở, và Radix dựng nó sau lần vẽ đổi `open`: theo dõi chính phần tử (ref dạng hàm), không theo `open`
  const [node, setNode] = useState<HTMLDivElement | null>(null)
  const panelRef = useCallback((el: HTMLDivElement | null) => {
    contentRef.current = el
    setNode(el)
  }, [contentRef])

  useLayoutEffect(() => {
    const el = node
    if (!el) return
    const fit = () => writePlacement(el, phone || !placement ? null : fitPlacement(placement, sizeOf(el), boundsOf(surface, dock)))
    fit()
    if (phone || !placement) return
    // Phóng to / thu nhỏ có chuyển động bề rộng, chiều cao: kẹp lại khi chuyển động xong
    el.addEventListener('transitionend', fit)
    window.addEventListener('resize', fit)
    return () => {
      el.removeEventListener('transitionend', fit)
      window.removeEventListener('resize', fit)
    }
  }, [node, phone, placement, expanded, surface, dock])

  function save(el: HTMLElement, point: PanelPoint) {
    const next = placementOf(point, sizeOf(el), boundsOf(surface, dock).viewport)
    writePlacement(el, next)
    assistantSession.setPlacement(next)
    return next
  }

  function currentPoint(el: HTMLElement): PanelPoint {
    const rect = el.getBoundingClientRect()
    return { left: rect.left, top: rect.top }
  }

  function handlePointerDown(event: PointerEvent<HTMLElement>) {
    const el = contentRef.current
    if (phone || !el || event.button !== 0) return
    // Nút trong đầu khung (bắt đầu lại, phóng to, đóng) vẫn là nút; chỉ tay nắm và phần còn lại của đầu khung kéo được
    const button = (event.target as Element).closest('button')
    if (button && button !== gripRef.current) return
    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, origin: currentPoint(el), moving: false }
  }

  function handlePointerMove(event: PointerEvent<HTMLElement>) {
    const el = contentRef.current
    const state = drag.current
    if (!el || !state || state.pointerId !== event.pointerId) return
    const dx = event.clientX - state.x
    const dy = event.clientY - state.y
    if (!state.moving) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return
      state.moving = true
      el.dataset.dragging = ''
    }
    writePoint(el, clampPosition({ left: state.origin.left + dx, top: state.origin.top + dy }, sizeOf(el), boundsOf(surface, dock)))
  }

  function handlePointerEnd(event: PointerEvent<HTMLElement>) {
    const el = contentRef.current
    const state = drag.current
    if (!state || state.pointerId !== event.pointerId) return
    drag.current = null
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    if (!el || !state.moving) return
    delete el.dataset.dragging
    save(el, snapPosition(currentPoint(el), sizeOf(el), boundsOf(surface, dock)))
  }

  function announce(next: PanelPlacement) {
    setAnnouncement(t('assistant.panel.moved', {
      x: t(`assistant.panel.edges.${next.x}`),
      dx: next.dx,
      y: t(`assistant.panel.edges.${next.y}`),
      dy: next.dy,
    }))
  }

  function resetPlacement() {
    assistantSession.setPlacement(null)
    setAnnouncement(t('assistant.panel.positionReset'))
    gripRef.current?.focus()
  }

  function handleGripKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const el = contentRef.current
    if (!el || phone) return
    if (event.key === 'Home') {
      event.preventDefault()
      resetPlacement()
      return
    }
    const step = event.shiftKey ? PANEL_STEP_LARGE : PANEL_STEP
    const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key]
    if (!delta) return
    event.preventDefault()
    const point = nudgePosition(currentPoint(el), sizeOf(el), boundsOf(surface, dock), { left: delta[0]!, top: delta[1]! })
    announce(save(el, point))
  }

  return {
    panelRef,
    gripRef,
    announcement,
    resetPlacement,
    headerHandlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerEnd,
      onPointerCancel: handlePointerEnd,
    },
    handleGripKeyDown,
  }
}
