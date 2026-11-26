import { RotateCw, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useT } from '@/lib/i18n'

/**
 * Lớp phủ DOM khi khung 3D mất ngữ cảnh WebGL (dùng chung Planner, kho, tài xế qua `SceneCanvas`): nói chuyện gì xảy ra và cho dựng lại
 * khung 3D. Nền tối đặc như panel trên khung 3D; nút 56 px trên máy cảm ứng.
 */
export function ContextLostOverlay({ onReload }: { onReload: () => void }) {
  const t = useT()
  return (
    <div role="alert" className="absolute inset-0 z-10 flex items-center justify-center bg-canvas-1 p-4">
      <div className="flex max-w-96 flex-col items-center gap-3 rounded-lg border border-border-dark bg-panel-dark px-6 py-5 text-center">
        <TriangleAlert aria-hidden strokeWidth={1.5} className="size-6 text-glass-dark-muted" />
        <p className="text-body font-semibold text-glass-dark-text pointer-coarse:text-body-lg">{t('plannerRecovery.contextLost.title')}</p>
        <p className="text-small text-glass-dark-muted pointer-coarse:text-body-lg">{t('plannerRecovery.contextLost.description')}</p>
        <Button variant="glass" className="pointer-coarse:h-14 pointer-coarse:text-body-lg" onClick={onReload}>
          <RotateCw aria-hidden strokeWidth={1.5} />
          {t('plannerRecovery.contextLost.reload')}
        </Button>
      </div>
    </div>
  )
}
