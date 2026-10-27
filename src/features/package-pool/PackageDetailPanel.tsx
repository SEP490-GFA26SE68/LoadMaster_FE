import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Pencil, X } from 'lucide-react'

import { Banner } from '@/components/Banner'
import { HandlingClassChip } from '@/components/HandlingClassChip'
import { PackageQrImage } from '@/components/PackageQrImage'
import { Spinner } from '@/components/ui/Spinner'
import { Badge } from '@/components/ui/Badge'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { useCan } from '@/features/auth/useCan'
import { PackageFormDialog } from './PackageFormDialog'

import { ApiError } from '@/lib/api-client'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'

import { useCargoPackageQuery, usePackageTypesQuery } from './usePackagePoolQuery'


type Props = {
  id: string
  packageId: string
  onClose: () => void
}

export function PackageDetailPanel({
  id,
  packageId,
  onClose,
}: Props) {
  const t = useT()
  const format = useFormat()
  const can = useCan()
  const canManage = can('packages.manage')

  const [editing, setEditing] = useState(false)

  const titleId = useId()
  const titleRef = useRef<HTMLHeadingElement>(null)

  // GET /api/packages/{id}
  const packageQuery = useCargoPackageQuery(packageId)

  // GET /api/package-types, dùng để lấy tên loại kiện.
  const typesQuery = usePackageTypesQuery(0, 100)

  const pkg = packageQuery.data

  const packageType = typesQuery.data?.data.find(
    (type) => type.id === pkg?.packageTypeId,
  )

  useEffect(() => {
    if (pkg) {
      titleRef.current?.focus()
    }
  }, [packageId, pkg])

  const displayCode = pkg?.packageCode || (
    pkg ? `PKG-${pkg.id}` : packageId
  )

  return (
    <>
    <aside
      id={id}
      aria-label={t('sourcing.detail.panelTitle', { code: displayCode })}
      className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-bg xl:sticky xl:top-0 xl:max-h-[calc(100dvh-236px)]"
    >
      <header className="flex flex-none items-start gap-3 border-b border-border py-4 pr-2 pl-4">
        <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
          <h2
            ref={titleRef}
            id={titleId}
            tabIndex={-1}
            className="max-w-full rounded-sm font-mono text-h3 font-semibold text-ink-strong outline-none wrap-anywhere"
          >
            {displayCode}
          </h2>

          {pkg ? (
            <Badge>
              {t(`sourcing.detail.status.${pkg.status}`)}
            </Badge>
          ) : null}
        </div>
        {pkg && canManage ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setEditing(true)}
          >
            <Pencil size={16} strokeWidth={1.5} />
            {t('sourcing.detail.edit')}
          </Button>
        ) : null}

        <button
          type="button"
          aria-label={t('sourcing.detail.close')}
          onClick={onClose}
          className="grid size-9 flex-none cursor-pointer place-items-center rounded-md text-ink-3 hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <X
            className="size-4"
            strokeWidth={1.5}
            aria-hidden
          />
        </button>
      </header>

      {packageQuery.isPending ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : packageQuery.error || !pkg ? (
        <div className="p-4">
          <Banner tone="danger">
            {packageQuery.error instanceof ApiError
              ? packageQuery.error.message
              : packageQuery.error
                ? dataErrorMessage(packageQuery.error, t)
                : t('sourcing.detail.loadError')}
          </Banner>
        </div>
      ) : (
        <div className="flex min-h-0 flex-col gap-6 overflow-y-auto p-4">
          {/* Mã QR do BE sinh khi tạo CargoPackage */}
          <div className="flex flex-col items-center gap-3">
            <PackageQrImage
              packageId={pkg.id}
              token={pkg.qrToken}
              size={160}
            />
          </div>

          <section
            aria-labelledby={`${titleId}-info`}
            className="flex flex-col gap-3"
          >
            <h3
              id={`${titleId}-info`}
              className="text-body font-semibold text-ink-strong"
            >
              {t('sourcing.detail.info')}
            </h3>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              {pkg.packageName ? (
                <Field label={t('sourcing.form.packageName')} wide>
                  {pkg.packageName}
                </Field>
              ) : null}
              <Field label={t('sourcing.detail.poolId')}>
                <span className="font-mono text-caption">
                  {pkg.id}
                </span>
              </Field>

              <Field label={t('sourcing.form.handlingClass')}>
                <HandlingClassChip
                  handlingClass={pkg.handlingClass}
                />
              </Field>

              <Field label={t('sourcing.detail.dimensions')}>
                <span className="font-mono text-caption tabular-nums">
                  {format.dimensions(
                    pkg.lengthCm,
                    pkg.widthCm,
                    pkg.heightCm,
                  )}
                </span>
              </Field>

              <Field label={t('sourcing.detail.weight')}>
                <span className="font-mono text-caption tabular-nums">
                  {format.weight(pkg.weightKg)}
                </span>
              </Field>

              <Field
                label={t('sourcing.detail.destination')}
                wide
              >
                {pkg.destination}
              </Field>
              {pkg.note ? (
                <Field label={t('sourcing.form.note')} wide>
                  {pkg.note}
                </Field>
              ) : null}

              <Field
                label={t('sourcing.detail.packageType')}
                wide
              >
                {pkg.packageTypeId === undefined
                  ? t('sourcing.detail.packageTypeNone')
                  : packageType
                    ? (
                      <span>
                        {packageType.name}
                        {' · '}
                        {packageType.typeCode ?? packageType.id}
                      </span>
                    )
                    : (
                      <span className="font-mono text-caption">
                        {typesQuery.isPending
                          ? t('sourcing.detail.loadingPackageType')
                          : `ID: ${pkg.packageTypeId}`}
                      </span>
                    )}
              </Field>

              <Field label={t('sourcing.detail.transportOrder')}>
                {pkg.orderId
                  ? (
                    <span className="font-mono text-caption">
                      {pkg.orderId}
                    </span>
                  )
                  : t('sourcing.detail.noTransportOrder')}
              </Field>

              {pkg.trackingBarcode ? (
                <Field label={t('sourcing.detail.trackingBarcode')} wide>
                  <span className="font-mono text-caption">
                    {pkg.trackingBarcode}
                  </span>
                </Field>
              ) : null}

              <Field label={t('sourcing.detail.pinned')}>
                {pkg.isPinned ? t('common.yes') : t('common.no')}
              </Field>
            </dl>
          </section>

          <section className="flex flex-col gap-3">
            <h3 className="text-body font-semibold text-ink-strong">
              {t('sourcing.form.packingRules')}
            </h3>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Field label={t('sourcing.form.orientation')} wide>
                {pkg.orientation
                  ? pkg.orientation
                    .split(',')
                    .map((value) => {
                      const labels: Record<string, string> = {
                        '0': 'L × W × H',
                        '1': 'L × H × W',
                        '2': 'W × L × H',
                        '3': 'W × H × L',
                        '4': 'H × L × W',
                        '5': 'H × W × L',
                      }

                      const direction = value.trim()

                      return `${direction} (${labels[direction] ?? direction})`
                    })
                    .join(', ')
                  : '—'}
              </Field>

              <Field label={t('sourcing.form.uprightOnly')}>
                {pkg.uprightOnly == null
                  ? '—'
                  : pkg.uprightOnly
                    ? t('common.yes')
                    : t('common.no')}
              </Field>

              <Field label={t('sourcing.form.fragilityLevel')}>
                {pkg.fragilityLevel ?? '—'}
              </Field>

              <Field label={t('sourcing.form.stackable')}>
                {pkg.stackable == null
                  ? '—'
                  : pkg.stackable
                    ? t('common.yes')
                    : t('common.no')}
              </Field>

              <Field label={t('sourcing.form.maxTopLoad')}>
                {pkg.maxTopLoadKg == null
                  ? '—'
                  : format.weight(pkg.maxTopLoadKg)}
              </Field>

              <Field label={t('sourcing.form.maxLayers')}>
                {pkg.maxLayers ?? '—'}
              </Field>

              <Field label={t('sourcing.form.minSupportRatio')}>
                {pkg.minSupportRatio == null
                  ? '—'
                  : `${Math.round(pkg.minSupportRatio * 100)}%`}
              </Field>
            </dl>
          </section>

          <section className="flex flex-col gap-3">
            <h3 className="text-body font-semibold text-ink-strong">
              {t('sourcing.form.optimization')}
            </h3>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Field label={t('sourcing.form.priority')}>
                {pkg.priority ?? '—'}
              </Field>

              <Field label={t('sourcing.form.mustLoad')}>
                {pkg.mustLoad == null
                  ? '—'
                  : pkg.mustLoad
                    ? t('common.yes')
                    : t('common.no')}
              </Field>

              <Field label={t('sourcing.form.packingGroup')} wide>
                {pkg.packingGroup || '—'}
              </Field>
            </dl>
          </section>

        </div>
      )}
    </aside>
    {canManage && editing && pkg ? (
      <PackageFormDialog
        editPackage={pkg}
        onClose={() => setEditing(false)}
        onDone={() => {}}
        onUpdated={(updated) => {
          setEditing(false)

          toast.success(
            t('sourcing.detail.updated', {
              code:
                updated.packageCode ||
                `PKG-${updated.id}`,
            }),
          )
        }}
      />
    ) : null}
  </>
  )
}

function Field({
  label,
  wide = false,
  children,
}: {
  label: string
  wide?: boolean
  children: ReactNode
}) {
  return (
    <div
      className={
        wide
          ? 'col-span-2 flex flex-col gap-0.5'
          : 'flex min-w-0 flex-col items-start gap-0.5'
      }
    >
      <dt className="text-caption text-ink-3">
        {label}
      </dt>

      <dd className="text-body text-ink-1">
        {children}
      </dd>
    </div>
  )
}