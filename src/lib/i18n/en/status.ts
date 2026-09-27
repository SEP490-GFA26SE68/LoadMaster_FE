import type { Dictionary } from '../types'
import type { status as source } from '../vi/status'

export const status = {
  nhap: 'Draft',
  da_toi_uu: 'Optimized',
  da_duyet: 'Approved',
  dang_van_chuyen: 'In transit',
  hoan_thanh: 'Completed',
  da_huy: 'Cancelled',
  sub: {
    stale: 'Stale — optimize again',
    loading: 'Warehouse loading {recorded} / {total}',
    loaded: 'Fully loaded',
  },
} satisfies Dictionary<typeof source>
