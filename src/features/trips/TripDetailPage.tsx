import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { useCan } from '@/features/auth/useCan'
import { RequirementAssignDialog } from '@/features/requirements/RequirementAssignDialog'
import { tripLabelsPath } from '@/features/package-pool/packages-list'
import type { CargoPackage } from '@/domain/models'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { PackageFormPanel } from './PackageFormPanel'
import { PackageImportDialog } from './PackageImportDialog'
import { emptyPackage } from './package-defaults'
import { PackagesTable } from './PackagesTable'
import { RouteDiagram } from './RouteDiagram'
import { cargoSummary, stopRows, type StopRow } from './trip-summary'
import { TripDetailHeader } from './TripDetailHeader'
import { TripDetailSide } from './TripDetailSide'
import { TripRequirementsCard } from './TripRequirementsCard'
import { TripReadinessCard } from './TripReadinessCard'
import {
  useDeletePackageMutation,
  useDuplicatePackageMutation,
  useRemoveStopMutation,
  useSavePackageMutation,
  useTripDetailQuery,
  useTripStopsMutation,
} from './useTripsQuery'

/**
 * Chi tiết chuyến hàng (LM-043 → LM-046, LM-088, LM-093, LM-095, LM-097; V2.3 LM-103): dải trời có tên chuyến, tiến trình và banner
 * theo pha; card sơ đồ tuyến đè lên đáy dải (thứ tự điểm giao kéo ngang được, bấm một điểm để lọc bảng kiện); dưới là bảng kiện và cột
 * phải (tóm tắt hàng, phương tiện, sự cố). Chọn một kiện thì cột phải thành panel kiện và sơ đồ tuyến thu về cột trái
 * (`ChiTietChuyenKien.jpg`).
 * Dữ liệu đọc từ mock repository qua Query. Chỉ sửa được khi có quyền và chuyến còn lập kế hoạch (D-41, D-45); từ lúc kho bắt đầu
 * xếp, banner nói lý do và mọi thao tác sửa ẩn đi. LM-104: chuyến còn lập kế hoạch có card "Kiểm tra trước khi tối ưu" đầu cột phải;
 * dưới bảng kiện là "Yêu cầu giao trên chuyến" (đưa vào / gỡ yêu cầu khi có quyền `trips.edit`, FE-4b-01).
 */
export function TripDetailPage() {
  const { tripId = '' } = useParams()
  const t = useT()
  const can = useCan()
  const query = useTripDetailQuery(tripId)
  const stopsMutation = useTripStopsMutation(tripId)
  const removeStop = useRemoveStopMutation(tripId)
  const savePackage = useSavePackageMutation(tripId)
  const deletePackage = useDeletePackageMutation(tripId)
  const duplicatePackage = useDuplicatePackageMutation(tripId)
  const [searchParams, setSearchParams] = useSearchParams()
  const [draft, setDraft] = useState<CargoPackage | null>(null)
  const [importing, setImporting] = useState(false)
  const [assigning, setAssigning] = useState(false)
  // Điểm giao đang lọc bảng kiện: điểm trên sơ đồ tuyến và ô chọn trên bảng dùng chung
  const [stopFilter, setStopFilter] = useState<number | null>(null)

  const trip = query.data?.trip
  const vehicle = query.data?.vehicle
  // Quản lý xem chuyến chỉ đọc (D-41); từ lúc kho bắt đầu xếp, xe, điểm giao và kiện bị khoá (D-45)
  const editable = can('trips.edit') && trip?.phase === 'planning'
  // Đưa yêu cầu giao vào điểm giao khi chuyến còn lập kế hoạch và người xem sửa được chuyến (điều phối viên)
  const canAssign = can('trips.edit') && trip?.phase === 'planning'
  const openAssign = canAssign ? () => setAssigning(true) : undefined
  const stops = useMemo<StopRow[]>(() => (trip ? stopRows(trip.stops, trip.packages) : []), [trip])
  const summary = useMemo(() => (trip && vehicle ? cargoSummary(trip.packages, vehicle) : null), [trip, vehicle])
  const delivered = trip?.phase === 'delivering' || trip?.phase === 'completed'
  // `?kien=<mã>` mở panel của kiện đó — liên kết từ validation summary của Thiết lập tối ưu (LM-047).
  const linkedId = searchParams.get('kien')
  const editing = draft ?? trip?.packages.find((pkg) => pkg.id === linkedId) ?? null
  function setEditing(next: CargoPackage | null) {
    setDraft(next)
    if (linkedId !== null) setSearchParams((params) => { params.delete('kien'); return params }, { replace: true })
  }

  function handleRemoveStop(stop: StopRow) {
    removeStop.mutate(stop.id, {
      onSuccess: (result) => {
        if (result.allowed) toast.success(t('trips.stops.removed', { name: stop.name }))
        else toast.error(t('trips.stops.removeBlocked', { name: stop.name, count: result.affectedInstances }))
      },
    })
  }

  function handleSave(pkg: CargoPackage, keepOpen: boolean) {
    savePackage.mutate(pkg, {
      onSuccess: () => {
        toast.success(t('trips.form.saved', { id: pkg.id }))
        setEditing(keepOpen ? emptyPackage(trip?.packages ?? [], pkg.deliveryStop) : null)
      },
    })
  }

  function handleDuplicate(pkg: CargoPackage) {
    duplicatePackage.mutate(pkg.id, {
      onSuccess: (copy) => { toast.success(t('trips.form.duplicated', { id: copy.id })); setEditing(copy) },
    })
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <TripDetailHeader tripId={tripId} detail={query.data} />

      {query.isPending ? (
        <div role="status" aria-label={t('trips.detail.loading')} className="grid flex-1 place-items-center"><Spinner /></div>
      ) : !trip || !vehicle || !summary ? (
        <div className="flex flex-1 flex-col items-start gap-3 px-shell py-8">
          <h2 className="text-h2 font-semibold">{t('trips.detail.notFound', { id: tripId })}</h2>
          <Button variant="secondary" asChild><Link to="/chuyen">{t('common.backToTrips')}</Link></Button>
        </div>
      ) : (
        // V2.3: vùng cuộn đè lên đáy dải trời (`sky-overlap`), card sơ đồ tuyến nằm nửa trên dải
        <div className="sky-overlap min-h-0 flex-1 overflow-auto px-shell pb-8">
          {/*
            Không chọn kiện: sơ đồ tuyến chiếm cả hàng, dưới là bảng kiện và cột phải 360 px. Chọn một kiện: panel kiện chiếm cột phải
            452 px từ đỉnh vùng, sơ đồ tuyến thu về cột trái (`ChiTietChuyenKien.jpg`). Hẹp hơn 1.280 px thì xếp chồng một cột.
            Vị trí đổi bằng grid-template-areas, không dựng thẻ hai lần.
          */}
          <div className={cn('grid items-start gap-4', editing
            ? 'xl:grid-cols-[minmax(0,1fr)_452px] xl:[grid-template-areas:"route_side"_"main_side"]'
            : 'xl:grid-cols-[minmax(0,1fr)_360px] xl:[grid-template-areas:"route_route"_"main_side"]')}>
            <div className="min-w-0 xl:[grid-area:route]">
              {/* Trạng thái giao chỉ khi chuyến đang giao hoặc đã hoàn thành (LM-097) */}
              <RouteDiagram
                stops={stops}
                delivery={delivered ? trip.delivery : undefined}
                readOnly={!editable}
                onReorder={(next) => stopsMutation.mutate(next)}
                onRemove={handleRemoveStop}
                selectedStop={stopFilter}
                onSelectStop={setStopFilter}
              />
            </div>

            <div className="flex min-w-0 flex-col gap-3 xl:[grid-area:main]">
              <PackagesTable
                packages={trip.packages}
                vehicle={vehicle}
                stops={stops}
                selectedId={editing?.id ?? null}
                onSelect={(pkg) => setEditing(editing?.id === pkg.id ? null : pkg)}
                onAdd={editable ? () => setEditing(emptyPackage(trip.packages, stops[0]?.number ?? 1)) : undefined}
                onImport={editable ? () => setImporting(true) : undefined}
                labelsHref={can('labels.print') ? tripLabelsPath(tripId) : undefined}
                stopFilter={stopFilter}
                onStopFilterChange={setStopFilter}
              />
              {/* Yêu cầu giao trên chuyến: ngay dưới bảng kiện — mỗi yêu cầu đưa vào là các dòng kiện của bảng này */}
              <TripRequirementsCard trip={trip} onAssign={openAssign} />
              {editable ? <PackageImportDialog trip={trip} vehicle={vehicle} open={importing} onOpenChange={setImporting} /> : null}
              {canAssign ? <RequirementAssignDialog open={assigning} onOpenChange={setAssigning} tripId={tripId} /> : null}
            </div>

            {editing ? (
              // Ô lưới giãn hết hai hàng để panel tự dính (sticky, card riêng của panel) khi cuộn bảng kiện; không bọc thêm card
              <div className="min-w-0 xl:self-stretch xl:[grid-area:side]">
              <PackageFormPanel
                key={editing.id}
                tripId={tripId}
                value={editing}
                vehicle={vehicle}
                stops={stops}
                readOnly={!editable}
                onSave={handleSave}
                onDelete={trip.packages.some((pkg) => pkg.id === editing.id)
                  ? (pkg) => deletePackage.mutate(pkg.id, { onSuccess: () => setEditing(null) })
                  : undefined}
                onDuplicate={trip.packages.some((pkg) => pkg.id === editing.id) ? handleDuplicate : undefined}
                onClose={() => setEditing(null)}
              />
              </div>
            ) : (
              // Chuyến còn lập kế hoạch: "Kiểm tra trước khi tối ưu" đứng đầu cột phải (LM-104)
              <div className="flex min-w-0 flex-col gap-4 xl:[grid-area:side]">
                {trip.phase === 'planning' ? <TripReadinessCard tripId={tripId} onAssignRequirement={openAssign} /> : null}
                <TripDetailSide trip={trip} vehicle={vehicle} driver={query.data?.driver ?? null} summary={summary} editable={editable} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
