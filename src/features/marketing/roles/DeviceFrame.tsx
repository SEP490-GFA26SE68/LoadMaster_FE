import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { RoleDevice } from './roles-model'

/**
 * Khung thiết bị vẽ bằng DOM quanh một màn thu nhỏ: máy tính (màn 16:10 trên đế), máy tính bảng nằm ngang (4:3), điện thoại đứng.
 * Viền máy là `--panel-dark`, không bóng (mục 5). Hình minh hoạ: `aria-hidden`, bản chữ tương đương nằm cạnh nó ở nơi gọi.
 */
export function DeviceFrame({ device, className, children }: { device: RoleDevice; className?: string; children: ReactNode }) {
  if (device === 'laptop') {
    return (
      <div aria-hidden className={cn('w-full', className)}>
        <div className="mx-auto w-[92%] rounded-t-[14px] rounded-b-[4px] bg-panel-dark p-[1.6%] pb-[2%]">
          <div className="aspect-[16/10] overflow-hidden rounded-[4px]">{children}</div>
        </div>
        <div className="h-2.5 rounded-b-[10px] border border-t-0 border-border bg-n-100 sm:h-3">
          <div className="mx-auto h-1 w-[14%] rounded-b-[6px] bg-n-200" />
        </div>
      </div>
    )
  }
  if (device === 'tablet') {
    return (
      <div aria-hidden className={cn('w-full', className)}>
        <div className="rounded-[22px] bg-panel-dark p-[2.6%]">
          <div className="aspect-[4/3] overflow-hidden rounded-[8px]">{children}</div>
        </div>
      </div>
    )
  }
  return (
    <div aria-hidden className={cn('w-full', className)}>
      <div className="rounded-[26px] bg-panel-dark p-[5%]">
        <div className="relative aspect-[9/17] overflow-hidden rounded-[16px]">
          {children}
          <span className="absolute top-[1.4%] left-1/2 h-[2.2%] w-[26%] -translate-x-1/2 rounded-full bg-panel-dark" />
        </div>
      </div>
    </div>
  )
}
