import { QrCode } from '@/components/QrCode'
import { HandlingClassChip } from '@/components/HandlingClassChip'
import { useFormat, useT } from '@/lib/i18n'
import type { PackageLabel as PackageLabelData } from './package-pool-api'
import { cn } from '@/lib/utils'

export function PackageLabel({
  label,
  print = false,
}: {
  label: PackageLabelData
  print?: boolean
}) {
  const t = useT()
  const format = useFormat()
  const pkg = label.package

  return (
    <article
      className={cn(
        'flex w-[320px] flex-col rounded-lg border border-border bg-white p-4 text-black shadow-sm',
        print && 'w-[90mm] rounded-none border border-black shadow-none',
      )}
    >
      {/* Header */}
      <header className="mb-3 flex items-center gap-3 border-b pb-2">
        <img
          src="/logo-loadmaster.png"
          alt="LoadMaster"
          className="size-10 object-contain"
        />
        <div className="min-w-0">
          <h2 className="text-base font-bold leading-5 text-ink-strong">
            LoadMaster
          </h2>
          <p className="text-xs text-ink-2">
            Nhãn kiện hàng
          </p>
        </div>
      </header>

      {/* QR */}
      <div className="flex flex-col items-center gap-2 py-2">
        <QrCode
          token={pkg.qrToken}
          size={print ? 140 : 128}
          showToken={false}
        />
        <div className="text-center">
          <p className="font-mono text-sm font-semibold">
            {pkg.packageCode || `PKG-${pkg.id}`}
          </p>
          <p className="font-mono text-xs text-ink-2">
            {pkg.qrToken}
          </p>
        </div>
      </div>

      {/* Info */}
      <dl className="mt-3 grid grid-cols-[92px_1fr] gap-x-2 gap-y-1 text-sm">
        <dt className="text-ink-3">Loại hàng</dt>
        <dd>
          <HandlingClassChip handlingClass={pkg.handlingClass} />
        </dd>

        <dt className="text-ink-3">Kích thước</dt>
        <dd className="font-mono">
          {format.dimensions(
            pkg.lengthCm,
            pkg.widthCm,
            pkg.heightCm,
          )}
        </dd>

        <dt className="text-ink-3">Khối lượng</dt>
        <dd className="font-mono">
          {format.weight(pkg.weightKg)}
        </dd>

        <dt className="text-ink-3">Điểm đến</dt>
        <dd className="break-words">
          {pkg.destination}
        </dd>
      </dl>
    </article>
  )
}