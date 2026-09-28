import { AlertCircle, Check, CircleCheck, Pencil, Play, RefreshCw, TriangleAlert, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import type { ConstraintIssue } from '@/domain/constraints'
import type { OptimizationResult } from '@/domain/models'
import { formatIssue, useFormat, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { PlanApproval } from './approval/plan-approval'

/** Dòng kiểm vận hành (thứ tự điểm giao, LIFO — LM-036): chỉ hỗ trợ xem xét, không phải lý do chặn. */
export type ApprovalCheck = {
  tone: 'success' | 'warning' | 'danger'
  text: string
}

/** Cảnh báo liệt kê nguyên câu trong hộp thoại; phần còn lại gộp thành "… và N cảnh báo khác". */
const LISTED_WARNINGS = 3
/** Mã kiện chỉnh tay hiện thành nhãn; nhiều hơn thì "+N". */
const LISTED_PATCHES = 8
const LIFO_CODES: ReadonlySet<string> = new Set(['LIFO_BLOCKED', 'LIFO_PARTIAL'])

/**
 * Xác nhận Duyệt (LM-050; V2.3 `Planner3DDuyet`, `Planner3DTatLIFO`): số chính của phương án, lý do chặn (`approvalBlockers` của
 * domain) hoặc "Không có lỗi chặn duyệt", cảnh báo còn lại kèm câu của từng cảnh báo — lần chạy tắt LIFO thì nói cảnh báo đến từ kiểm
 * tra LIFO — các dòng kiểm vận hành, kiện chỉnh tay (mã từng kiện) và việc thứ tự xếp/dỡ sẽ được tính lại. Còn lý do chặn thì nút Duyệt
 * khoá. Có cảnh báo LIFO thì chân hộp thoại có lối "Xem mô phỏng dỡ hàng".
 */
export function ApprovePlanDialog({ open, onOpenChange, metrics, canSubmit, approval, checks, pending, onConfirm, isMockResult = false, lifoOff = false, onShowUnloading }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  metrics: OptimizationResult['metrics']
  /** Fixture benchmark không có revision trong kho: xem được kiểm tra nhưng không gửi Duyệt. */
  canSubmit: boolean
  approval: PlanApproval
  checks: readonly ApprovalCheck[]
  pending: boolean
  onConfirm: () => void
  /** Spec: kết quả mock mang nhãn MOCK RESULT (không dịch). */
  isMockResult?: boolean
  /** Lần chạy tắt "Bắt buộc thứ tự dỡ theo điểm giao (LIFO)" — cảnh báo LIFO là hệ quả của thiết lập đó. */
  lifoOff?: boolean
  /** Đóng hộp thoại và mở mô phỏng dỡ hàng. */
  onShowUnloading?: () => void
}) {
  const t = useT()
  const format = useFormat()
  const { blockers, warnings, patches } = approval
  const blocked = blockers.stale || blockers.issues.length > 0
  const lifoCount = warnings.filter((issue) => LIFO_CODES.has(issue.code)).length
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-145">
        <DialogHeader icon={blocked ? AlertCircle : CircleCheck} tone={blocked ? 'danger' : 'success'}
          title={t('viewer.plan.dialog.title')} description={t('viewer.plan.dialog.description')}>
          <DialogClose asChild>
            <Button variant="ghost" size="icon" aria-label={t('viewer.plan.dialog.close')} className="-mt-1 -mr-2 text-n-600">
              <X strokeWidth={1.5} aria-hidden />
            </Button>
          </DialogClose>
        </DialogHeader>

        <div className="flex flex-col gap-4 px-7 pt-4 pb-4.5">
          <div className="grid grid-cols-3 gap-2.5">
            <Stat label={t('viewer.plan.volume')}><span className="text-primary">{format.percent(metrics.volumeUtilizationPercent)}</span></Stat>
            <Stat label={t('viewer.plan.payload')}>{format.percent(metrics.payloadUtilizationPercent)}</Stat>
            <Stat label={t('viewer.plan.placed')}>
              {format.integer(metrics.placedCount)} <span className="text-small font-medium text-ink-3">/ {format.integer(metrics.placedCount + metrics.unplacedCount)}</span>
            </Stat>
          </div>

          <ul className="m-0 flex list-none flex-col p-0 text-body text-ink-2">
            {blocked ? (
              <Row tone="danger" icon={<AlertCircle className="size-4" strokeWidth={2} aria-hidden />}>
                <div role="alert" className="flex flex-col gap-1.5">
                  <b className="font-semibold text-red-700">{t('viewer.plan.dialog.blockersTitle')}</b>
                  <ul className="m-0 flex list-none flex-col gap-1 p-0 text-red-700">
                    {blockers.stale ? <li>{t('viewer.plan.dialog.stale')}</li> : null}
                    {blockers.issues.map((issue, index) => <li key={`${issue.code}-${index}`}>{formatIssue(issue, t, format)}</li>)}
                  </ul>
                </div>
              </Row>
            ) : (
              <Row tone="success" icon={<CircleCheck className="size-4" strokeWidth={2} aria-hidden />}>
                <b className="font-semibold text-green-700">{t('viewer.plan.dialog.noBlockers')}</b>
              </Row>
            )}

            {warnings.length > 0 ? (
              <Row tone="warning" icon={<TriangleAlert className="size-4" strokeWidth={2} aria-hidden />}>
                {t('viewer.plan.dialog.warnings', { count: warnings.length })}
                <WarningDetail warnings={warnings} lifoCount={lifoCount} lifoOff={lifoOff} />
              </Row>
            ) : (
              <Row tone="success" icon={<Check className="size-4" strokeWidth={2.5} aria-hidden />}>{t('viewer.plan.dialog.noWarnings')}</Row>
            )}

            {checks.map((check) => (
              <Row key={check.text} tone={check.tone} icon={check.tone === 'success'
                ? <Check className="size-4" strokeWidth={2.5} aria-hidden />
                : <TriangleAlert className="size-4" strokeWidth={2} aria-hidden />}>
                {check.text}
              </Row>
            ))}

            <Row tone="note" icon={<Pencil className="size-4" strokeWidth={1.75} aria-hidden />}>
              {patches.length > 0 ? t('viewer.plan.dialog.manual', { count: patches.length }) : t('viewer.plan.dialog.noManual')}
              {patches.length > 0 ? (
                <span className="mt-1.5 flex flex-wrap gap-1.5">
                  {patches.slice(0, LISTED_PATCHES).map((patch) => (
                    <span key={patch.packageInstanceId} className="inline-flex h-5.5 items-center rounded-sm bg-n-100 px-1.75 font-mono text-caption text-ink-2">
                      {patch.packageInstanceId}
                    </span>
                  ))}
                  {patches.length > LISTED_PATCHES ? <span className="inline-flex h-5.5 items-center px-1 text-caption text-ink-3">+{format.integer(patches.length - LISTED_PATCHES)}</span> : null}
                </span>
              ) : null}
            </Row>
            <Row tone="note" icon={<RefreshCw className="size-4" strokeWidth={1.75} aria-hidden />}>{t('viewer.plan.dialog.ordersRecomputed')}</Row>
          </ul>
        </div>

        <DialogFooter className="px-5.5">
          {onShowUnloading && lifoCount > 0 || isMockResult ? (
            <span className="mr-auto flex items-center gap-2">
              {onShowUnloading && lifoCount > 0 ? (
                <Button variant="ghost" className="h-9.5 px-3 text-primary hover:text-primary-hover" onClick={onShowUnloading}>
                  <Play strokeWidth={1.75} aria-hidden />{t('viewer.plan.dialog.showUnloading')}
                </Button>
              ) : null}
              {isMockResult ? <Badge shape="tag" tone="mock">MOCK RESULT</Badge> : null}
            </span>
          ) : null}
          <DialogClose asChild><Button variant="secondary">{t('viewer.plan.dialog.cancel')}</Button></DialogClose>
          <Button variant="primary" disabled={!canSubmit || !blockers.canApprove || pending} loading={pending} onClick={onConfirm}>
            <Check strokeWidth={1.5} />{t('viewer.plan.dialog.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Khung hổ phách dưới dòng cảnh báo: lần chạy tắt LIFO thì nói cảnh báo đến từ đâu, không thì câu của vài cảnh báo đầu. */
function WarningDetail({ warnings, lifoCount, lifoOff }: { warnings: readonly ConstraintIssue[]; lifoCount: number; lifoOff: boolean }) {
  const t = useT()
  const format = useFormat()
  const box = 'mt-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-small text-ink-strong'
  if (lifoOff && lifoCount > 0) {
    const setting = t('optimization.enforceLifo')
    return (
      <p className={cn('m-0', box)}>
        {lifoCount === warnings.length
          ? t('viewer.plan.dialog.lifoOnly', { count: lifoCount, setting })
          : t('viewer.plan.dialog.lifoSome', { lifo: format.integer(lifoCount), count: format.integer(warnings.length), setting })}
      </p>
    )
  }
  return (
    <ul className={cn('m-0 flex list-none flex-col gap-0.5', box)}>
      {warnings.slice(0, LISTED_WARNINGS).map((issue, index) => <li key={`${issue.code}-${index}`}>{formatIssue(issue, t, format)}</li>)}
      {warnings.length > LISTED_WARNINGS ? <li className="text-ink-3">{t('viewer.plan.dialog.moreWarnings', { count: warnings.length - LISTED_WARNINGS })}</li> : null}
    </ul>
  )
}

const ROW_ICON = { success: 'text-green-700', warning: 'text-amber-700', danger: 'text-red-700', note: 'text-ink-3' } as const

function Row({ tone, icon, children }: { tone: keyof typeof ROW_ICON; icon: ReactNode; children: ReactNode }) {
  return (
    <li className="grid grid-cols-[20px_minmax(0,1fr)] gap-2.5 border-t border-line-soft py-2.5 first:border-t-0 first:pt-0 last:pb-0">
      <span className={cn('flex pt-0.5', ROW_ICON[tone])}>{icon}</span>
      <div className="min-w-0">{children}</div>
    </li>
  )
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-n-25 px-3 py-2.5">
      <span className="text-fine text-ink-3">{label}</span>
      <span className="font-display text-h2 leading-6 font-bold text-ink-strong tabular-nums font-stretch-106%">{children}</span>
    </div>
  )
}
