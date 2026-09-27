import { QrCode } from 'lucide-react'
import { useSearchParams } from 'react-router'
import { ScreenShell } from '@/components/ScreenShell'
import { useT } from '@/lib/i18n'
import { usePackageLabelsQuery } from './usePackagesSourceQuery'

/** `?kien=RPK-0001,RPK-0002`: in đúng các kiện đó; vắng là mọi kiện người đăng nhập thấy. */
function pickedIds(search: URLSearchParams): string[] | undefined {
  const raw = search.get('kien')
  return raw ? raw.split(',').map((id) => id.trim()).filter(Boolean) : undefined
}

/** Trang in nhãn QR `/kien-hang/nhan` (luồng 1, LM-104). Khung màn: đếm nhãn in được; lưới nhãn `QrCode` do bước giao diện dựng tiếp. */
export function PackageLabelsPage() {
  const t = useT()
  const [search] = useSearchParams()
  const query = usePackageLabelsQuery(pickedIds(search))
  const count = query.data?.length ?? 0
  return (
    <ScreenShell
      title={t('sourcing.labels.title')}
      description={t('pageHero.labels')}
      icon={QrCode}
      loading={query.isPending}
      error={query.error}
      summary={count === 0 ? t('sourcing.packages.empty') : t('sourcing.labels.count', { count })}
    />
  )
}
