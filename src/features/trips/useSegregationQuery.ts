import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { HandlingClass } from '@/domain/models'
import { isMockDbError } from '@/lib/mock-db'
import { getTripSegregation, overrideTripSegregation } from './segregation-api'

/**
 * Hook cho phân tách hàng của chuyến (FE-4b-06). Khoá đọc nằm dưới `['trips', tripId]`: mọi lần đổi kiện của chuyến làm mới thẻ
 * "Phân nhóm hàng". Ghi lý do vượt luật đổi mục "Loại hàng" của "Kiểm tra trước khi tối ưu", nên làm mới cả chuyến.
 */
export function useTripSegregationQuery(tripId: string) {
  return useQuery({ queryKey: ['trips', tripId, 'segregation'], queryFn: () => getTripSegregation(tripId), enabled: tripId !== '', staleTime: 0 })
}

export function useOverrideSegregationMutation(tripId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (reason: string) => overrideTripSegregation(tripId, reason),
    onSuccess: () => client.invalidateQueries({ queryKey: ['trips', tripId] }),
  })
}

/** Điều hộp thoại vượt luật cần biết: loại hàng đang khoá của chuyến và mã các kiện khác loại. */
export type SegregationConflictInfo = { readonly lockedClass: HandlingClass; readonly packages: readonly string[] }

/** Lỗi `CARGO_SEGREGATION_CONFLICT` của kho, hoặc `null` khi là lỗi khác. */
export function segregationConflictOf(error: unknown): SegregationConflictInfo | null {
  if (!isMockDbError(error) || error.code !== 'CARGO_SEGREGATION_CONFLICT') return null
  const { lockedClass, packages } = error.params as { lockedClass: HandlingClass; packages: string[] }
  return { lockedClass, packages }
}

/** Một lần ghi đang chờ lý do vượt luật: `retry` gọi lại đúng lần ghi đó kèm lý do. */
export type SegregationPending = SegregationConflictInfo & { readonly retry: (reason: string) => Promise<unknown>; readonly initialReason?: string }

/**
 * Chặn lỗi phân tách hàng của một lần đưa kiện vào chuyến: `intercept(error, retry)` trả `true` và mở hộp thoại vượt luật
 * (`SegregationOverrideDialog pending={pending}`) khi lỗi là `CARGO_SEGREGATION_CONFLICT`; lỗi khác trả `false` để nơi gọi tự báo.
 */
export function useSegregationGuard() {
  const [pending, setPending] = useState<SegregationPending | null>(null)
  return {
    pending,
    open: setPending,
    close: () => setPending(null),
    intercept(error: unknown, retry: (reason: string) => Promise<unknown>): boolean {
      const conflict = segregationConflictOf(error)
      if (conflict) setPending({ ...conflict, retry })
      return conflict !== null
    },
  }
}
