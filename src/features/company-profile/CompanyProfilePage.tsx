import { RotateCcw } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { PageHero } from '@/components/PageHero'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { dataErrorMessage, useT } from '@/lib/i18n'
import { CompanyProfileForm } from './CompanyProfileForm'
import { CompanyProfileIdentity } from './CompanyProfileIdentity'
import { useCompanyProfileQuery } from './useCompanyProfileQuery'

/**
 * Thông tin công ty `/cong-ty` (`companyProfile.manage`, quản trị công ty): cùng bố cục với Hồ sơ — thẻ nhận diện bên trái (tên công ty
 * và những gì chỉ quản trị hệ thống đổi được), thẻ form bên phải. Nối backend thì đọc, ghi `/api/company/profile`; không thì kho mẫu.
 * Hẹp hơn 1.024 px thì dồn một cột, thẻ nhận diện lên trên.
 */
export function CompanyProfilePage() {
  const t = useT()
  const query = useCompanyProfileQuery()
  const profile = query.data

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      {/* Thứ đầu tiên của vùng cuộn là thẻ nền đặc — chỉ khi đã có dữ liệu mới đè lên dải trời */}
      <PageHero title={t('companyProfile.title')} description={t('pageHero.companyProfile')} overlap={profile !== undefined} />
      {profile !== undefined ? (
        <main className="sky-overlap min-h-0 flex-1 overflow-y-auto px-shell pb-6 max-sm:px-4">
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[288px_minmax(0,1fr)] lg:gap-5">
            <CompanyProfileIdentity profile={profile} />
            <CompanyProfileForm key={profile.company.id} profile={profile} />
          </div>
        </main>
      ) : query.isError ? (
        <main className="min-h-0 flex-1 overflow-auto px-shell py-6">
          <EmptyState
            mascot="error"
            title={dataErrorMessage(query.error, t)}
            action={<Button variant="secondary" onClick={() => void query.refetch()}><RotateCcw strokeWidth={1.5} />{t('companyProfile.retry')}</Button>}
          />
        </main>
      ) : (
        <div role="status" aria-label={t('companyProfile.loading')} className="flex justify-center py-16"><Spinner /></div>
      )}
    </div>
  )
}
