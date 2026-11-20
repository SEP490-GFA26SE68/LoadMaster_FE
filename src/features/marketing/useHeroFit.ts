import { useSyncExternalStore } from 'react'
import { HERO_INSETS, type HeroTier, type StageView } from '@/features/viewer3d/landing/diorama-layout'
import type { Insets } from '@/features/viewer3d/scene/frame-fit'

/** Cùng mốc với `xl:` (1.280 px) và `md:` (768 px) của Tailwind, để bố cục vẽ bằng JS khớp lớp CSS của trang. */
const WIDE = '(min-width: 80rem)'
const MEDIUM = '(min-width: 48rem)'

const hasMatchMedia = () => typeof window.matchMedia === 'function'

function readTier(): HeroTier {
  if (!hasMatchMedia()) return 'medium'
  if (window.matchMedia(WIDE).matches) return 'wide'
  return window.matchMedia(MEDIUM).matches ? 'medium' : 'narrow'
}

function subscribe(listener: () => void): () => void {
  if (!hasMatchMedia()) return () => {}
  const lists = [WIDE, MEDIUM].map((query) => window.matchMedia(query))
  for (const list of lists) list.addEventListener('change', listener)
  return () => {
    for (const list of lists) list.removeEventListener('change', listener)
  }
}

export type HeroFit = {
  tier: HeroTier
  /** Lề của góc Toàn cảnh nơi nút, thẻ chuyến và Lumo nằm đè lên khung (ảnh tĩnh và khung 3D canh cùng lề). */
  insets: Insets
  /** Góc nhìn lúc mở: điện thoại cận thùng xe (sân kho thu nhỏ trong khung 358 px thì kiện quá bé), rộng hơn là toàn cảnh. */
  defaultView: StageView
}

/**
 * Bậc bề rộng của phần mở đầu trang giới thiệu: `wide` từ 1.280 px (thẻ, nút và Lumo nằm đè trên khung 3D), `medium` 768–1.279 px và
 * `narrow` dưới 768 px (thẻ, Lumo nằm thành hàng ngoài khung). Không có `matchMedia` thì coi là `medium`. Đổi theo cửa sổ.
 */
export function useHeroFit(): HeroFit {
  const tier = useSyncExternalStore(subscribe, readTier, () => 'medium' as const)
  return { tier, insets: HERO_INSETS[tier], defaultView: tier === 'narrow' ? 'truck' : 'overview' }
}
