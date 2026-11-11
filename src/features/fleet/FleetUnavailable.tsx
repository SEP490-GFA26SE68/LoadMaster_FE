import { PageHero } from '@/components/PageHero'
import { Banner } from '@/components/Banner'

/**
 * Màn của Đội xe khi nguồn đang dùng không có việc người xem mở (trang thêm xe khi nguồn không ghi được): thanh tiêu đề và
 * một câu lý do. Màn không dựng truy vấn nào, nên không gọi backend.
 */
export function FleetUnavailable({ title, description, reason, back }: {
  title: string
  description?: string
  reason: string
  back?: { to: string; label: string }
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PageHero title={title} description={description} back={back} />
      <main className="min-h-0 flex-1 overflow-auto px-shell py-6">
        <Banner tone="info">{reason}</Banner>
      </main>
    </div>
  )
}
