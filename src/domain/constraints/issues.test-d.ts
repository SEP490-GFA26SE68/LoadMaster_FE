/**
 * Kiểm tra ở mức kiểu, chạy bằng `tsc -b` (tức `pnpm build`), không chạy trong Vitest.
 * Mỗi `@ts-expect-error` phải gặp đúng một lỗi trên dòng kế tiếp; nếu kiểu bị nới lỏng thì
 * directive thừa và build đỏ. Mỗi biểu thức kiểm tra viết trên một dòng vì lý do đó.
 */
import { expectTypeOf } from 'vitest'
import type { ExpandedPackages } from '@/domain/cargo'
import type { ConstraintCode, ConstraintIssue } from '@/domain/constraints'

// LM-013 báo trùng ID bằng đúng kiểu dùng chung, không còn kiểu tạm riêng.
expectTypeOf<ExpandedPackages['issues'][number]>().toEqualTypeOf<ConstraintIssue<'DUPLICATE_INSTANCE_ID'>>()

// Danh mục mã đúng bằng danh sách trong docs/issues/LM-014 (chép nguyên văn) cộng mã LM-023 và FE-5b-03 / FE-5b-04 thêm, không thiếu, không thừa.
expectTypeOf<ConstraintCode>().toEqualTypeOf<
  | 'DIMENSION_NOT_POSITIVE'
  | 'DOOR_EXCEEDS_INNER'
  | 'NO_ALLOWED_ORIENTATION'
  | 'PAYLOAD_EXCEEDED'
  | 'MUST_LOAD_PAYLOAD_EXCEEDED'
  | 'DOOR_TOO_SMALL'
  | 'EXCEEDS_BOUNDARY'
  | 'OVERLAP'
  | 'OBSTACLE_OVERLAP'
  | 'NON_BEARING_SUPPORT'
  | 'SUPPORT_BELOW_MIN'
  | 'TOP_LOAD_EXCEEDED'
  | 'NOT_STACKABLE'
  | 'STACK_COUNT_EXCEEDED'
  | 'LIFO_BLOCKED'
  | 'LIFO_PARTIAL'
  | 'COG_LATERAL'
  | 'COG_LONGITUDINAL'
  | 'COG_HIGH'
  | 'AXLE_OVERLOAD'
  | 'MUST_LOAD_UNPLACED'
  | 'LOADING_ORDER_INFEASIBLE'
  | 'DUPLICATE_INSTANCE_ID'
  | 'ORIENTATION_MISMATCH'
  | 'ORIENTATION_NOT_ALLOWED'
  | 'PINNED_INSTANCE_UNKNOWN'
>()
