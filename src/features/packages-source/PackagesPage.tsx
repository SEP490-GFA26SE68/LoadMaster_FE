import { Package } from 'lucide-react'
import { ScreenShell } from '@/components/ScreenShell'
import { useT } from '@/lib/i18n'
import { useRegisteredPackagesQuery } from './usePackagesSourceQuery'

/**
 * Kiện đã đăng ký `/kien-hang` (luồng 1, LM-104) — màn chính của nhà sản xuất. Khung màn: đếm kiện người đăng nhập thấy (kho lọc theo
 * công ty); đăng ký thủ công / theo số lượng / nhập file do bước giao diện dựng tiếp.
 */
export function PackagesPage() {
  const t = useT()
  const query = useRegisteredPackagesQuery()
  const count = query.data?.length ?? 0
  return (
    <ScreenShell
      title={t('sourcing.packages.title')}
      description={t('pageHero.packages')}
      icon={Package}
      loading={query.isPending}
      error={query.error}
      summary={count === 0 ? t('sourcing.packages.empty') : t('sourcing.packages.count', { count })}
    />
  )
}
