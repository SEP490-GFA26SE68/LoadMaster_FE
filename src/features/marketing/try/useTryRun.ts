import { useMutation } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { OptimizationProgress } from '@/services/optimization'
import { runTry } from './try-api'
import type { TryInput } from './try-form'

/** Lần chạy bị huỷ (nút Huỷ, gỡ mục khỏi trang) — không phải lỗi để báo đỏ. */
export function isAbort(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError'
}

/**
 * Một lần xếp thử theo lệnh của khách (`useMutation`), kèm tiến độ và nút huỷ. Mỗi lần chạy một `AbortController`: huỷ, chạy lần mới hay gỡ
 * mục khỏi trang đều huỷ lần đang chạy — service tối ưu `terminate` worker của nó. Tiến độ chỉ báo mỗi 25 kiện (bộ xếp quyết), nên vài
 * chục lần vẽ lại cho cả lượt, không theo khung hình.
 */
export function useTryRun() {
  const controller = useRef<AbortController | null>(null)
  const [progress, setProgress] = useState<OptimizationProgress | null>(null)
  const mutation = useMutation({
    mutationFn: (input: TryInput) => {
      controller.current?.abort()
      const own = new AbortController()
      controller.current = own
      setProgress(null)
      return runTry(input, { signal: own.signal, onProgress: setProgress }).finally(() => {
        if (controller.current === own) controller.current = null
      })
    },
  })
  useEffect(() => () => controller.current?.abort(), [])
  const cancel = useCallback(() => controller.current?.abort(), [])
  return { mutation, progress, cancel }
}
