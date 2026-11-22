import { zodResolver } from '@hookform/resolvers/zod'
import { ScanLine } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState, type RefObject } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { fieldBoxClass, focusClass } from '@/components/ui/field-styles'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { useT } from '@/lib/i18n'
import { VERIFY_METHODS, type LabelVerifyMethod, type ManualConfirmInput, type VerifyMethod } from '@/lib/mock-db'
import { cn } from '@/lib/utils'
import { PackageVerifyManual, type VerifyCandidate } from './PackageVerifyManual'
import { normalizeQrToken } from './qr-matrix'
import { QrCamera } from './QrScanDialog'
import { barcodeDetectorClass } from './useQrCamera'

export type { VerifyCandidate } from './PackageVerifyManual'

/** Mã người dùng đưa để đối chiếu bằng nhãn: quét (`QR`) hoặc gõ (`CODE` — mã QR in dưới hình, hoặc mã của bên gửi). */
export type VerifyCode = { readonly method: LabelVerifyMethod; readonly code: string }

/** Kết quả của lần đối chiếu gần nhất, nơi gọi dịch sẵn: hiện trong hộp và đọc được bằng trình đọc màn hình. */
export type VerifyOutcome = { readonly tone: 'success' | 'error'; readonly message: string }

type PackageVerifyProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  /** Mức 1 và 2: kho của nơi gọi kiểm mã như nhau, chỉ khác cách ghi. */
  onVerify: (input: VerifyCode) => void
  /** Mức 3: kiện chọn được ở bước này (kho: kiện của bước xếp hiện tại; tài xế: kiện chưa dỡ của điểm đang giao). */
  candidates: readonly VerifyCandidate[]
  onManual: (input: ManualConfirmInput) => void
  result?: VerifyOutcome | null
  pending?: boolean
  /** Mức nơi gọi làm được, theo thứ tự hiện (mặc định đủ ba mức). Chỉ một mức thì không có hàng tab. */
  methods?: readonly VerifyMethod[]
  /**
   * Nhãn và gợi ý của ô gõ mã, đã dịch — cho nơi gọi nhận mã khác với mặc định "mã QR hoặc mã bên gửi" (tài xế khi nối backend). Vắng
   * thì dùng chữ mặc định.
   */
  codeLabel?: string
  codeHint?: string
  /** Explicit execution action; existing verification callers keep their default label/queue. */
  submitLabel?: string
  queueWhilePending?: boolean
  disabled?: boolean
}

type CodeValues = { code: string }

/** Mức mở đầu: quét khi có camera và nơi gọi cho quét; không thì gõ mã; còn lại là mức đầu nơi gọi cho. */
function initialMethod(methods: readonly VerifyMethod[]): VerifyMethod {
  if (methods.includes('QR') && barcodeDetectorClass()) return 'QR'
  if (methods.includes('CODE')) return 'CODE'
  return methods[0] ?? 'CODE'
}

function candidateKey(candidates: readonly VerifyCandidate[]): string {
  return candidates.map((candidate) => candidate.packageInstanceId).join('|')
}

/** Ô và nút của màn cảm ứng: 56 px, chữ 16 px (mục 10) — hộp này chỉ dùng ở kho (máy tính bảng) và tài xế (điện thoại). */
const TOUCH_FIELD = 'h-14 w-full min-w-0 px-3 text-body-lg'

function VerifyBody({
  inputRef, title, description, onVerify, candidates, onManual, result, pending = false, methods = VERIFY_METHODS,
  codeLabel, codeHint, submitLabel, queueWhilePending = true, disabled = false, onClose, onPeek,
  method, onMethodChange, draftCode, onDraftCode, formResetKey,
}: Omit<PackageVerifyProps, 'open' | 'onOpenChange' | 'methods'> & {
  methods: readonly VerifyMethod[]
  formResetKey: string
  inputRef: RefObject<HTMLInputElement | null>
  onClose: () => void
  onPeek: () => void
  method: VerifyMethod
  onMethodChange: (method: VerifyMethod) => void
  draftCode: string
  onDraftCode: (code: string) => void
}) {
  const t = useT()
  const codeId = useId()
  const codeFormId = useId()
  const lastScanned = useRef<string | null>(null)
  const schema = useMemo(() => z.object({ code: z.string().trim().min(1, t('qr.verify.codeRequired')) }), [t])
  const form = useForm<CodeValues>({ resolver: zodResolver(schema), defaultValues: { code: draftCode } })
  const codeError = form.formState.errors.code?.message
  const { ref: registerRef, ...codeField } = form.register('code', {
    onChange: (event) => onDraftCode(event.target.value),
  })
  // Mã gõ (hay máy quét mã vạch gõ rồi Enter) trong lúc lần trước còn chờ kho: xếp hàng, gửi tiếp khi lần trước xong — không mất mã nào.
  const queued = useRef<VerifyCode[]>([])
  const current = candidates.length === 1 ? candidates[0] : null

  const skipResetOnMount = useRef(true)

  useEffect(() => {
    if (pending) return
    const next = queued.current.shift()
    if (next) onVerify(next)
  }, [pending, onVerify])

  useEffect(() => {
    if (skipResetOnMount.current) {
      skipResetOnMount.current = false
      return
    }
    form.reset({ code: '' })
  }, [formResetKey, form])

  useEffect(() => {
    if (result?.tone !== 'success') return
    form.reset({ code: '' })
    onDraftCode('')
  }, [result, form, onDraftCode])

  function submitCode(input: VerifyCode) {
    if (disabled) return
    if (pending) {
      if (queueWhilePending && !queued.current.some((entry) => entry.code === input.code)) queued.current.push(input)
    } else onVerify(input)
    // Chọn sẵn mã vừa gửi: gõ hay quét mã kế tiếp là thay chỗ, mã vẫn đọc được khi kho báo lỗi
    inputRef.current?.select()
  }

  // Mã sai vẫn nằm trước camera thì không gửi lại liên tục; đưa mã khác vào khung là gửi ngay.
  function handleDetected(raw: string) {
    const code = normalizeQrToken(raw)
    if (!code || pending || code === lastScanned.current) return
    lastScanned.current = code
    onVerify({ method: 'QR', code })
  }

  return (
    <>
      <DialogHeader className="flex-none" icon={ScanLine} title={title} description={description ? <span className="text-body-lg">{description}</span> : undefined} />
      {current ? (
        <p className="m-0 flex-none px-5 text-body-lg text-ink-2 sm:px-7">
          {t('qr.verify.currentPackage', { name: current.name })}
          {current.description ? ` · ${current.description}` : ''}
        </p>
      ) : null}
      <Tabs
        value={method}
        onValueChange={(next) => onMethodChange(next as VerifyMethod)}
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-5 text-body-lg sm:px-7"
      >
        {methods.length > 1 ? (
          <TabsList aria-label={t('qr.verify.levels')} className="px-0">
            {methods.map((level) => (
              <TabsTrigger key={level} value={level} className="h-14 min-w-0 flex-1 justify-center px-2 text-body-lg whitespace-normal">
                {t(`common.verifyMethods.${level}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        ) : null}

        {methods.includes('QR') ? (
          <TabsContent value="QR" className="flex flex-col gap-3 outline-none">
            <QrCamera onDetected={handleDetected} statusClassName="text-body-lg" />
          </TabsContent>
        ) : null}

        <TabsContent value="CODE" className="outline-none">
          <form
            id={codeFormId}
            noValidate
            className="flex flex-col gap-3"
            onSubmit={(event) => void form.handleSubmit(({ code }) => submitCode({ method: 'CODE', code }))(event)}
          >
            <div className="flex flex-col gap-1.5">
              <label htmlFor={codeId} className="font-medium">{codeLabel ?? t('qr.verify.codeLabel')}</label>
              <input
                id={codeId}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                aria-invalid={codeError ? true : undefined}
                aria-describedby={`${codeId}-mo-ta`}
                // Cỡ cảm ứng đứng sau kiểu ô chung: `cn` giữ lớp cỡ chữ đứng cuối
                className={cn(fieldBoxClass(Boolean(codeError)), focusClass, TOUCH_FIELD, 'font-mono')}
                {...codeField}
                ref={(element) => {
                  registerRef(element)
                  inputRef.current = element
                }}
              />
              <span id={`${codeId}-mo-ta`} className={codeError ? 'text-danger' : 'text-ink-3'}>{codeError ?? codeHint ?? t('qr.verify.codeHint')}</span>
            </div>
          </form>
        </TabsContent>

        {methods.includes('MANUAL') ? (
          <TabsContent value="MANUAL" className="outline-none">
            <PackageVerifyManual candidates={candidates} pending={pending} onSubmit={onManual} />
          </TabsContent>
        ) : null}

        {/* Kết quả lần đối chiếu gần nhất: lỗi là `alert` (đọc ngay), kết quả ghi được là `status` */}
        {result ? (
          <p
            role={result.tone === 'error' ? 'alert' : 'status'}
            data-verify-result={result.tone}
            className={cn('m-0 rounded-md border px-3 py-2.5 text-body-lg font-medium', result.tone === 'error'
              ? 'border-badge-danger-border bg-badge-danger-bg text-badge-danger-fg'
              : 'border-badge-success-border bg-badge-success-bg text-badge-success-fg')}
          >
            {result.message}
          </p>
        ) : null}
      </Tabs>
      <DialogFooter className="flex-none flex-wrap px-5 sm:px-7">
        <Button type="button" variant="secondary" size="touch" className="mr-auto" onClick={onPeek}>{t('qr.verify.peek')}</Button>
        <Button type="button" variant="secondary" size="touch" onClick={onClose}>{t('qr.verify.close')}</Button>
        {method === 'CODE' ? (
          <Button
            type="submit"
            form={codeFormId}
            size="touch"
            loading={pending}
            disabled={disabled || (pending && !queueWhilePending)}
          >
            {submitLabel ?? t('qr.verify.codeSubmit')}
          </Button>
        ) : null}
      </DialogFooter>
    </>
  )
}

/**
 * Đối chiếu kiện ba mức (FE-6-03, D-83) — một hộp dùng chung cho kho (soạn, xếp) và tài xế (dỡ, nhận dọc đường):
 *
 * 1. **Quét QR** bằng camera (`QrCamera` của `QrScanDialog`);
 * 2. **Gõ mã**: mã QR in dưới hình, hoặc mã của bên gửi — kho chỉ nhận mã của bên gửi khi nó duy nhất trong chuyến;
 * 3. **Xác nhận tay**: chọn kiện + lý do khi nhãn không đọc được — ghi `MANUAL_PENDING`, điều phối viên duyệt (FE-6-04).
 *
 * Hộp giữa màn, lớp phủ mỏng để còn đọc mã kiện / sơ đồ phía sau. "Xem sơ đồ" thu hộp xuống đáy, không đóng, không mất chữ đang gõ.
 * Chữ đang gõ giữ theo kiện hiện tại, xóa khi đổi kiện hoặc đối chiếu đúng. Không hiện Package Code trong hộp.
 * Khi camera chạy, con trỏ đứng ở hộp thoại để bàn phím ảo không che khung hình; không có camera thì hộp mở ở mức 2 và con trỏ vào ô gõ mã.
 * Nơi gọi chưa làm được mọi mức (tài xế khi nối backend: quét và gõ mã, chưa có xác nhận tay) truyền `methods`: mức không có trong đó không hiện.
 */
export function PackageVerify({ open, onOpenChange, methods = VERIFY_METHODS, candidates, result, ...body }: PackageVerifyProps) {
  const t = useT()
  const contentRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const levels = methods ?? VERIFY_METHODS
  const methodKey = levels.join(',')
  const draftKey = candidateKey(candidates)
  const [draftCode, setDraftCode] = useState('')
  const [method, setMethod] = useState<VerifyMethod>(() => initialMethod(levels))
  const [peeking, setPeeking] = useState(false)
  const startsOnCode = initialMethod(levels) === 'CODE'

  useEffect(() => {
    const nextLevels = methodKey.split(',') as VerifyMethod[]
    setDraftCode('')
    setMethod(initialMethod(nextLevels.length > 0 ? nextLevels : VERIFY_METHODS))
    setPeeking(false)
  }, [draftKey, methodKey])

  useEffect(() => {
    if (!open) setPeeking(false)
  }, [open])

  useEffect(() => {
    if (result?.tone === 'success') setDraftCode('')
  }, [result])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={contentRef}
        sheet
        overlayClassName={peeking ? 'place-items-end bg-transparent p-4 sm:p-6' : 'bg-cyan-950/25'}
        className={cn(
          'pointer-events-auto',
          peeking
            ? 'max-h-none w-full max-w-160 max-md:max-h-none'
            : 'max-h-[min(42rem,calc(100dvh-5rem))]',
        )}
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          if (startsOnCode && !peeking) inputRef.current?.focus()
          else contentRef.current?.focus()
        }}
        onPointerDownOutside={(event) => event.preventDefault()}
        onFocusOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        {peeking ? (
          <>
            <DialogHeader className="flex-none" icon={ScanLine} title={body.title} description={<span className="text-body-lg">{t('qr.verify.peekingHint')}</span>} />
            <DialogFooter className="flex-none px-5 sm:px-7">
              <Button type="button" variant="primary" size="touch" className="w-full" onClick={() => setPeeking(false)}>
                {t('qr.verify.resume')}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <VerifyBody
            {...body}
            candidates={candidates}
            result={result}
            methods={levels}
            formResetKey={draftKey}
            inputRef={inputRef}
            method={method}
            onMethodChange={setMethod}
            draftCode={draftCode}
            onDraftCode={setDraftCode}
            onPeek={() => setPeeking(true)}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
