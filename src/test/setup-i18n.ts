// Nhập thẳng `translate.ts` (không qua `@/lib/i18n`): chỉ mục của i18n kéo theo api-client, nạp nó ở setup thì `vi.mock` của
// `backend-config` trong file test không còn áp lên api-client nữa.
import { loadLocale } from '@/lib/i18n/translate'

/** Từ điển `en` tải lười trong app; test dịch cả hai ngôn ngữ một cách đồng bộ nên tải sẵn. */
await loadLocale('en')
