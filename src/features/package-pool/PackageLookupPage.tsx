import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, ScanLine, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useSearchParams } from 'react-router'
import { z } from 'zod'
import { Banner } from '@/components/Banner'
import { EmptyState } from '@/components/EmptyState'
import { PageHero } from '@/components/PageHero'
import { QrScanDialog } from '@/components/QrScanDialog'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { useCan } from '@/features/auth/useCan'
import { dataErrorMessage, useT } from '@/lib/i18n'
import { isMockDbError } from '@/lib/mock-db'
import { cn } from '@/lib/utils'
import { CODE_PARAM, lookupView, PICK_PARAM } from './package-lookup'
import { PackageLookupCard } from './PackageLookupCard'
import { PackageLookupList } from './PackageLookupList'
import { usePackageLookupQuery, useReportPackageFoundMutation, useScanPackageMutation } from './usePackagePoolQuery'

const isUnknown = (error: unknown) => isMockDbError(error) && error.code === 'QR_UNKNOWN'

/** Chữ 16 px cho nhãn, gợi ý và lỗi của ô nhập ở màn cảm ứng (mặc định 13 / 12,5 px). */
const TOUCH_FIELD = '[&_label]:text-body-lg [&_span]:text-body-lg'

/**
 * Tra cứu kiện `/tra-cuu-kien` (FE-3b-06, D-63, D-71, D-92), mở theo `packages.lookup` — điều phối viên và nhân viên kho. Quét mã QR
 * (`QrScanDialog`) hoặc gõ mã QR / mã của bên gửi / mã của kho: mã đang tra nằm trên URL (`?ma=`), nên quay lại từ trang in nhãn vẫn
 * thấy đúng kiện. Mã không khớp, hay khớp kiện của công ty khác, đều là "Không tìm thấy". Nhiều kiện trùng mã của bên gửi thì liệt
 * kê để chọn.
 *
 * Nhân viên kho **quét** thấy kiện đang mang cờ "Không tìm thấy" thì cờ được gỡ ngay và điều phối viên được báo qua chuông; gõ mã thì
 * thẻ kiện có nút xác nhận — gõ mã chưa chắc là đang cầm kiện. Nhân viên kho dùng máy tính bảng: nút 56 px, chữ từ 16 px, và nút về
 * màn kho trên dải trời. "Quét mã QR" là hành động chính của màn.
 */
export function PackageLookupPage() {
  const t = useT()
  const can = useCan()
  const touch = can('warehouse.operate')
  const [search, setSearch] = useSearchParams()
  const code = search.get(CODE_PARAM)?.trim() ?? ''
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [foundId, setFoundId] = useState<string | null>(null)
  const query = usePackageLookupQuery(code)
  const scan = useScanPackageMutation()
  const found = useReportPackageFoundMutation()
  const view = lookupView({ code, pickedId: search.get(PICK_PARAM), pending: query.isPending, notFound: isUnknown(query.error), data: query.data })

  const schema = useMemo(() => z.object({ code: z.string().trim().min(1, t('lookup.codeRequired')) }), [t])
  const form = useForm<{ code: string }>({ resolver: zodResolver(schema), values: { code } })
  const size = touch ? 'touch' : 'md'

  function show(next: string, pickedId?: string) {
    setSearch(pickedId === undefined ? { [CODE_PARAM]: next } : { [CODE_PARAM]: next, [PICK_PARAM]: pickedId })
  }

  /** Mã từ camera, ô nhập hay danh sách của hộp thoại quét: tra theo mã QR; nhân viên kho quét thấy kiện mang cờ thì gỡ cờ luôn. */
  async function handleScan(token: string) {
    setScanError(null)
    try {
      const item = await scan.mutateAsync(token)
      if (touch && item.package.flags.includes('NOT_FOUND')) {
        await found.mutateAsync(item.package.qrToken)
        setFoundId(item.package.id)
      }
      setScanning(false)
      show(item.package.qrToken)
    } catch (error) {
      setScanError(isUnknown(error) ? t('lookup.notFound.description', { code: token }) : dataErrorMessage(error, t))
    }
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PageHero
        overlap
        title={t('lookup.title')}
        description={t('pageHero.lookup')}
        actions={touch ? (
          <Button variant="glass" size="touch" asChild>
            <Link to="/kho"><ArrowLeft strokeWidth={1.5} />{t('lookup.backToWarehouse')}</Link>
          </Button>
        ) : null}
      />
      <main className={cn('sky-overlap min-h-0 flex-1 overflow-auto px-shell pb-6', touch && 'text-body-lg')}>
        <div className="flex max-w-220 flex-col gap-4">
          <Card className="flex flex-wrap items-start gap-3 p-5">
            <form noValidate className="flex min-w-64 flex-1 flex-wrap items-start gap-3" onSubmit={form.handleSubmit((values) => { setFoundId(null); show(values.code) })}>
              <div className={cn('min-w-56 flex-1', touch && TOUCH_FIELD)}>
                <Input
                  label={t('lookup.codeLabel')}
                  placeholder={t('lookup.codePlaceholder')}
                  hint={t('lookup.codeHint')}
                  error={form.formState.errors.code?.message}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  className={cn('font-mono', touch && 'h-14 text-body-lg')}
                  {...form.register('code')}
                />
              </div>
              {/* Nút đứng ngang hàng ô nhập: bù chiều cao nhãn của ô */}
              <Button type="submit" variant="secondary" size={size} className={touch ? 'mt-7.5' : 'mt-6'}>
                <Search strokeWidth={1.5} />{t('lookup.submit')}
              </Button>
            </form>
            <Button variant="primary" size={size} className={touch ? 'mt-7.5' : 'mt-6'} onClick={() => { setScanError(null); setScanning(true) }}>
              <ScanLine strokeWidth={1.5} />{t('lookup.scan')}
            </Button>
          </Card>

          {view.kind === 'idle' ? (
            <EmptyState icon={ScanLine} className={touch ? '[&_span]:text-body-lg' : undefined} title={t('lookup.idle.title')} description={t('lookup.idle.description')} />
          ) : view.kind === 'pending' ? (
            query.error
              ? <Banner tone="danger">{dataErrorMessage(query.error, t)}</Banner>
              : <div role="status" aria-label={t('lookup.loading')} className="flex justify-center py-12"><Spinner /></div>
          ) : view.kind === 'notFound' ? (
            <EmptyState mascot="notFound" className={touch ? '[&_span]:text-body-lg' : undefined} title={t('lookup.notFound.title')} description={t('lookup.notFound.description', { code: view.code })} />
          ) : view.kind === 'many' ? (
            <PackageLookupList code={view.code} items={view.items} touch={touch} onPick={(id) => show(view.code, id)} />
          ) : (
            <PackageLookupCard
              item={view.item}
              touch={touch}
              justFound={foundId === view.item.package.id}
              onFound={setFoundId}
              onBack={view.fromMany ? () => show(code) : undefined}
            />
          )}
        </div>
      </main>

      <QrScanDialog
        open={scanning}
        onOpenChange={setScanning}
        title={t('lookup.scanTitle')}
        description={t('lookup.scanDescription')}
        onScan={(token) => void handleScan(token)}
        error={scanError}
        pending={scan.isPending || found.isPending}
      />
    </div>
  )
}
