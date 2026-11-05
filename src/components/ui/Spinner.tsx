import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'

/**
 * Spinner 16px cho trạng thái loading.
 * Khớp mục 3 style sheet: viền 2px, hở đỉnh, quay 0,7s tuyến tính. `label` nói đang tải gì (mặc định "Đang xử lý") để màn không
 * phải bọc thêm một vùng `status` thứ hai.
 */
export function Spinner({
  tone = 'dark',
  label,
  className,
}: {
  tone?: 'light' | 'dark'
  label?: string
  className?: string
}) {
  const t = useT()
  return (
    <span
      role="status"
      aria-label={label ?? t('common.processing')}
      className={cn(
        'inline-block size-4 flex-none rounded-full border-2 border-t-transparent opacity-90',
        'animate-[lm-spin_0.7s_linear_infinite]',
        tone === 'light' ? 'border-white' : 'border-text-2',
        className,
      )}
    />
  )
}
