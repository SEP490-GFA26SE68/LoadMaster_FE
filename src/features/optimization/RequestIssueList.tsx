import { AlertCircle, CheckCircle2, Info, Package, Repeat2, Route, TriangleAlert, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { formatIssue, useFormat, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { OptimizationSetup } from './optimization-api'
import type { IssueLink } from './optimization-request'
import { SETUP_LINK, VEHICLE_SELECT_ID } from './SetupContextPanels'
import type { CheckItem, CheckState, SetupChecklist } from './setup-checklist'

type RowState = CheckState | 'info'

const ROW: Record<RowState, { icon: LucideIcon; tone: string }> = {
  pass: { icon: CheckCircle2, tone: 'text-green-700' },
  fail: { icon: AlertCircle, tone: 'text-red-700' },
  warn: { icon: TriangleAlert, tone: 'text-amber-700' },
  info: { icon: Info, tone: 'text-cyan-700' },
}

/**
 * Thẻ "Kiểm tra trước khi tối ưu" (V2.3 `ThietLapToiUu.jpg`, `ThietLapToiUuLoi.jpg`; LM-047): dải kết luận (không lỗi / còn cảnh báo /
 * còn lỗi), rồi từng điều kiện theo nhóm Tuyến · Xe · Kiện · Tải trọng — mục đạt kèm số của chuyến, mục lỗi liệt kê từng issue với nhãn
 * Lỗi / Cảnh báo. Nhóm Tuyến (FE-5b-05): chuyến phải đã tối ưu tuyến; chưa thì có lối về Chi tiết chuyến. Issue của xe và của kiện là liên kết tới nơi sửa (trang xe, panel kiện `?kien=`); mục tải trọng có "Đổi xe" (đưa con trỏ về
 * ô chọn xe) và "Sửa kiện".
 */
export function RequestIssueList({ tripId, setup, checklist, canRun, locked = false }: {
  tripId: string
  setup: OptimizationSetup
  checklist: SetupChecklist
  canRun: boolean
  locked?: boolean
}) {
  const t = useT()
  const format = useFormat()
  const { vehicle } = setup
  const { optional, door } = checklist
  const warned = [checklist.vehicle, checklist.dimensions, checklist.door, checklist.payload].some((item) => item.state === 'warn')

  return (
    <Card role="region" aria-labelledby="request-issues">
      <CardHeader>
        <CardTitle as="h2" id="request-issues">{t('optimization.summaryTitle')}</CardTitle>
      </CardHeader>
      {!canRun ? (
        <Strip tone="danger" icon={AlertCircle} role="alert">{t('optimization.blocked')}</Strip>
      ) : warned ? (
        <Strip tone="warning" icon={TriangleAlert}>{t('optimization.check.warnings')}</Strip>
      ) : (
        <Strip tone="success" icon={CheckCircle2}>{t('optimization.summaryClear')}</Strip>
      )}

      <Group label={t('optimization.groups.route')} divided={false}>
        <Line state={checklist.route.state} title={t('optimization.check.route')}>
          {checklist.route.state === 'pass' ? (
            <Detail>{t('optimization.check.routeDetail', { count: setup.trip.stops.length })}</Detail>
          ) : (
            <>
              <span className="mt-1 flex flex-col text-small leading-4.75">
                <span className="font-semibold text-red-700">{t('optimization.check.error')}</span>
                <span className="text-red-700">{t('optimization.check.routeMissing')}</span>
              </span>
              <Link to={`/chuyen/${tripId}`} className={cn(SETUP_LINK, 'mt-2 text-small')}>
                <Route aria-hidden className="size-3.5" strokeWidth={1.75} />{t('optimization.check.routeFix')}
              </Link>
            </>
          )}
        </Line>
      </Group>
      <Group label={t('optimization.groups.vehicle')}>
        <Row item={checklist.vehicle} title={t('optimization.check.vehicle')}
          detail={t('optimization.check.vehicleDetail', { vehicle: vehicle.name, door: format.widthByHeight(vehicle.doorWidthCm, vehicle.doorHeightCm) })} />
      </Group>
      <Group label={t('optimization.groups.packages')}>
        <Row item={checklist.dimensions} title={t('optimization.check.dimensions')}
          detail={t('optimization.check.dimensionsDetail', { lines: format.integer(checklist.dimensions.lines), count: format.integer(checklist.dimensions.instances) })} />
        <Row item={door} title={t('optimization.check.door')}
          detail={door.largest ? t('optimization.check.doorDetail', { name: door.largest.name, size: format.dimensions(door.largest.lengthCm, door.largest.widthCm, door.largest.heightCm) }) : null} />
        {optional ? (
          <Line state="info" title={t('optimization.check.optional', { count: optional.instances })}>
            <Detail>
              {optional.lines[0]?.name} · <span className="font-mono text-caption">{optional.lines[0]?.id}</span>
              {optional.lines.length > 1 ? ` ${t('optimization.check.optionalMore', { count: format.integer(optional.lines.length - 1) })}` : null}
            </Detail>
            <Link to={`/chuyen/${tripId}?kien=${optional.lines[0]?.id ?? ''}`} className={cn(SETUP_LINK, 'mt-1.5 text-small')}>{t('optimization.check.viewPackage')}</Link>
          </Line>
        ) : null}
      </Group>
      <Group label={t('optimization.groups.payload')}>
        <Row item={checklist.payload} title={t('optimization.check.payload')} plain
          detail={t('optimization.check.payloadDetail', {
            total: format.weight(checklist.payload.totalKg), max: format.weight(checklist.payload.maxPayloadKg), mustLoad: format.weight(checklist.payload.mustLoadKg),
          })}>
          {checklist.payload.state !== 'pass' ? (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {!locked ? (
                <button type="button" className={cn(SETUP_LINK, 'text-small')} onClick={() => document.getElementById(VEHICLE_SELECT_ID)?.focus()}>
                  <Repeat2 aria-hidden className="size-3.5" strokeWidth={1.75} />{t('optimization.check.changeVehicle')}
                </button>
              ) : null}
              <Link to={`/chuyen/${tripId}`} className={cn(SETUP_LINK, 'text-small')}>
                <Package aria-hidden className="size-3.5" strokeWidth={1.75} />{t('optimization.editPackages')}
              </Link>
            </div>
          ) : null}
        </Row>
      </Group>
      <div className="h-1.5" />
    </Card>
  )
}

function Strip({ tone, icon: Icon, role, children }: { tone: 'success' | 'warning' | 'danger'; icon: LucideIcon; role?: 'alert'; children: ReactNode }) {
  return (
    <p role={role} className={cn('mx-4.5 mt-3.5 mb-0.5 flex items-center gap-2.5 rounded-md px-3 py-2.5 text-lede font-semibold',
      tone === 'success' && 'bg-green-50 text-green-700', tone === 'warning' && 'bg-amber-50 text-amber-700', tone === 'danger' && 'bg-red-50 text-red-700')}>
      <Icon aria-hidden className="size-4.5 flex-none" strokeWidth={2} />
      {children}
    </p>
  )
}

function Group({ label, divided = true, children }: { label: string; divided?: boolean; children: ReactNode }) {
  return (
    <div className={cn('pt-2.5', divided && 'mt-1 border-t border-line-soft')}>
      <h3 className="px-4.5 text-caption font-semibold text-ink-3">{label}</h3>
      <ul className="m-0 list-none px-4.5 pb-1.5">{children}</ul>
    </div>
  )
}

/** Một điều kiện: icon theo trạng thái, tiêu đề, rồi chi tiết khi đạt hoặc các issue khi không đạt. `plain`: issue là chữ, không liên kết. */
function Row({ item, title, detail, plain = false, children }: { item: CheckItem; title: string; detail: string | null; plain?: boolean; children?: ReactNode }) {
  return (
    <Line state={item.state} title={title}>
      {item.state === 'pass' ? (detail ? <Detail>{detail}</Detail> : null) : item.issues.map((link, index) => <IssueEntry key={`${link.issue.code}-${index}`} link={link} plain={plain} />)}
      {children}
    </Line>
  )
}

function Line({ state, title, children }: { state: RowState; title: string; children: ReactNode }) {
  const { icon: Icon, tone } = ROW[state]
  return (
    <li className="grid grid-cols-[20px_minmax(0,1fr)] gap-2.75 border-t border-line-soft py-2.5 first:border-t-0">
      <Icon aria-hidden className={cn('mt-0.5 size-4.5', tone)} strokeWidth={2} />
      <div className="flex min-w-0 flex-col">
        <span className="text-body leading-5 font-semibold text-ink-strong">{title}</span>
        {children}
      </div>
    </li>
  )
}

function Detail({ children }: { children: ReactNode }) {
  return <span className="mt-0.5 text-small leading-4.75 text-ink-3">{children}</span>
}

function IssueEntry({ link, plain }: { link: IssueLink; plain: boolean }) {
  const t = useT()
  const format = useFormat()
  const error = link.issue.severity === 'error'
  const text = formatIssue(link.issue, t, format)
  const tone = error ? 'text-red-700' : 'text-ink-1'
  return (
    <span className="mt-1 flex flex-col text-small leading-4.75">
      <span className={cn('font-semibold', error ? 'text-red-700' : 'text-amber-700')}>{error ? t('optimization.check.error') : t('optimization.check.warning')}</span>
      {plain ? <span className={tone}>{text}</span> : (
        <Link to={link.to} className={cn('self-start rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-primary', tone)}>{text}</Link>
      )}
    </span>
  )
}
