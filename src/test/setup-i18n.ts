import { loadLocale } from '@/lib/i18n'

/** Từ điển `en` tải lười trong app; test dịch cả hai ngôn ngữ một cách đồng bộ nên tải sẵn. */
await loadLocale('en')
