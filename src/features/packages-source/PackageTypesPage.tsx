import { Shapes } from 'lucide-react'
import { ScreenShell } from '@/components/ScreenShell'
import { useT } from '@/lib/i18n'
import { usePackageTypesQuery } from './usePackagesSourceQuery'

/** Danh mục loại kiện `/loai-kien` (luồng 1, LM-104). Khung màn: đếm loại kiện thật trong kho; thân màn do bước giao diện dựng tiếp. */
export function PackageTypesPage() {
  const t = useT()
  const query = usePackageTypesQuery()
  const count = query.data?.length ?? 0
  return (
    <ScreenShell
      title={t('sourcing.packageTypes.title')}
      description={t('pageHero.packageTypes')}
      icon={Shapes}
      loading={query.isPending}
      error={query.error}
      summary={count === 0 ? t('sourcing.packageTypes.empty') : t('sourcing.packageTypes.count', { count })}
    />
  )
}
