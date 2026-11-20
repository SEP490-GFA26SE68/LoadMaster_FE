import { useMutation } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { runTry } from './try-api'
import type { TryInput } from './try-form'

/** Lần chạy bị bỏ (bấm chạy lại, gỡ phần khỏi trang) — không phải lỗi để báo đỏ. */
export function isAbort(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError'
}

/**
 * Một lần thử theo lệnh của khách (`useMutation`): chỉ chạy khi bấm. Mỗi lần chạy một `AbortController` — bấm lại trong lúc đang tính thì
 * lần cũ bị huỷ (service tối ưu `terminate` worker của nó) và kết quả cũ đang chờ bị bỏ, màn chỉ theo lần mới nhất; gỡ phần khỏi trang
 * cũng huỷ lần đang chạy.
 */
export function useTryRun() {
  const controller = useRef<AbortController | null>(null)
  useEffect(() => () => controller.current?.abort(), [])
  return useMutation({
    mutationFn: (input: TryInput) => {
      controller.current?.abort()
      const own = new AbortController()
      controller.current = own
      return runTry(input, { signal: own.signal }).finally(() => {
        if (controller.current === own) controller.current = null
      })
    },
  })
}
