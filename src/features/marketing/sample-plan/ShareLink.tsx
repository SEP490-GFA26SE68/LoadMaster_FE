import { Link2, Share2 } from 'lucide-react'
import { useState } from 'react'
import { SKY_FOCUS } from '@/components/sky-focus'
import { Button } from '@/components/ui/Button'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { PUBLIC_TOUCH } from '../public-chrome'

type Way = 'share' | 'copy'
type Outcome = 'shared' | 'copied' | 'failed' | null

/** Trình duyệt có bảng chia sẻ của hệ điều hành thì dùng nó (điện thoại), không thì chép vào bộ nhớ tạm; không có cả hai: không có nút. */
function wayOf(): Way | null {
  if (typeof navigator === 'undefined') return null
  if (typeof navigator.share === 'function') return 'share'
  return typeof navigator.clipboard?.writeText === 'function' ? 'copy' : null
}

/**
 * Nút phụ "Sao chép liên kết" (hay "Chia sẻ liên kết" khi có bảng chia sẻ) của trang phương án mẫu: liên kết `url` giữ đúng cảnh đang xem.
 * Kết quả nói ở vùng `role="status"` ngay dưới nút; người xem đóng bảng chia sẻ thì không nói gì.
 */
export function ShareLink({ url, className }: { url: string; className?: string }) {
  const t = useT()
  const [way] = useState(wayOf)
  const [outcome, setOutcome] = useState<Outcome>(null)
  if (!way) return null

  async function handleClick() {
    setOutcome(null)
    try {
      if (way === 'share') {
        await navigator.share({ title: t('samplePlan.share.title'), url })
        setOutcome('shared')
      } else {
        await navigator.clipboard.writeText(url)
        setOutcome('copied')
      }
    } catch (error) {
      setOutcome(error instanceof DOMException && error.name === 'AbortError' ? null : 'failed')
    }
  }

  const Icon = way === 'share' ? Share2 : Link2
  return (
    <div className={cn('flex flex-col items-start gap-2', className)}>
      <Button type="button" variant="glass" onClick={handleClick} className={cn(PUBLIC_TOUCH, SKY_FOCUS)}>
        <Icon aria-hidden strokeWidth={1.5} />
        {t(way === 'share' ? 'samplePlan.share.share' : 'samplePlan.share.copy')}
      </Button>
      <p className="m-0 text-small text-sky-text-3 pointer-coarse:text-body-lg">{t('samplePlan.share.note')}</p>
      <p role="status" className={cn('m-0 text-small pointer-coarse:text-body-lg', outcome === 'failed' ? 'text-amber-200' : 'text-cyan-200', !outcome && 'sr-only')}>
        {outcome ? t(`samplePlan.share.${outcome}`) : ''}
      </p>
    </div>
  )
}
