import { zodResolver } from '@hookform/resolvers/zod'
import { ScanLine } from 'lucide-react'
import { useId, useMemo, useRef, useState, type RefObject } from 'react'
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
}

type CodeValues = { code: string }

/** Ô và nút của màn cảm ứng: 56 px, chữ 16 px (mục 10) — hộp này chỉ dùng ở kho (máy tính bảng) và tài xế (điện thoại). */
const TOUCH_FIELD = 'h-14 w-full min-w-0 px-3 text-body-lg'

function VerifyBody({ inputRef, title, description, onVerify, candidates, onManual, result, pending = false, onClose }: Omit<PackageVerifyProps, 'open' | 'onOpenChange'> & {
  inputRef: RefObject<HTMLInputElement | null>
  onClose: () => void
}) {
  const t = useT()
  const codeId = useId()
  // Không quét được bằng camera (Safari, Firefox, máy bàn): mở thẳng mức 2
  const [method, setMethod] = useState<VerifyMethod>(() => (barcodeDetectorClass() ? 'QR' : 'CODE'))
  const lastScanned = useRef<string | null>(null)
  const schema = useMemo(() => z.object({ code: z.string().trim().min(1, t('qr.verify.codeRequired')) }), [t])
  const form = useForm<CodeValues>({ resolver: zodResolver(schema), defaultValues: { code: '' } })
  const codeError = form.formState.errors.code?.message
  const { ref: registerRef, ...codeField } = form.register('code')

  // Mã sai vẫn nằm trước camera thì không gửi lại liên tục; đưa mã khác vào khung là gửi ngay.
  function handleDetected(raw: string) {
    const code = normalizeQrToken(raw)
    if (!code || pending || code === lastScanned.current) return
    lastScanned.current = code
    onVerify({ method: 'QR', code })
  }

  return (
    <>
      <DialogHeader icon={ScanLine} title={title} description={description ? <span className="text-body-lg">{description}</span> : undefined} />
      <Tabs
        value={method}
        onValueChange={(next) => setMethod(next as VerifyMethod)}
        className="flex min-h-0 flex-col gap-4 px-5 py-5 text-body-lg sm:px-7"
      >
        <TabsList aria-label={t('qr.verify.levels')} className="px-0">
          {VERIFY_METHODS.map((level) => (
            <TabsTrigger key={level} value={level} className="h-14 min-w-0 flex-1 justify-center px-2 text-body-lg whitespace-normal">
              {t(`common.verifyMethods.${level}`)}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="QR" className="flex flex-col gap-3 outline-none">
          <QrCamera onDetected={handleDetected} statusClassName="text-body-lg" />
        </TabsContent>

        <TabsContent value="CODE" className="outline-none">
          <form noValidate className="flex flex-col gap-3" onSubmit={form.handleSubmit(({ code }) => onVerify({ method: 'CODE', code }))}>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={codeId} className="font-medium">{t('qr.verify.codeLabel')}</label>
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
              <span id={`${codeId}-mo-ta`} className={codeError ? 'text-danger' : 'text-ink-3'}>{codeError ?? t('qr.verify.codeHint')}</span>
            </div>
            <Button type="submit" size="touch" className="self-end" loading={pending}>{t('qr.verify.codeSubmit')}</Button>
          </form>
        </TabsContent>

        <TabsContent value="MANUAL" className="outline-none">
          <PackageVerifyManual candidates={candidates} pending={pending} onSubmit={onManual} />
        </TabsContent>

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
      <DialogFooter className="sticky bottom-0 px-5 sm:px-7">
        <Button type="button" variant="secondary" size="touch" onClick={onClose}>{t('qr.verify.close')}</Button>
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
 * Hộp không biết kiện "đúng" là kiện nào: nơi gọi gửi mã / kiện đã chọn cho kho và trả kết quả về qua `result`. Nút 56 px, chữ 16 px;
 * kết quả là vùng `status` / `alert` nên trình đọc màn hình đọc được. Dưới 768 px hộp là tờ trượt từ đáy (V2.3 đợt 6). Mỗi lần mở là một thân mới: về mức đầu, ô nhập trống. Khi camera
 * chạy, con trỏ đứng ở hộp thoại để bàn phím ảo không che khung hình; không có camera thì hộp mở ở mức 2 và con trỏ vào ô gõ mã.
 */
export function PackageVerify({ open, onOpenChange, ...body }: PackageVerifyProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={contentRef}
        // Điện thoại: tờ trượt từ đáy, nội dung cuộn cùng tờ và nút Đóng dính đáy; từ 768 px là hộp giữa màn rộng tối đa 640 px
        sheet
        className="w-[min(40rem,calc(100vw-3rem))]"
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          if (barcodeDetectorClass()) contentRef.current?.focus()
          else inputRef.current?.focus()
        }}
      >
        <VerifyBody {...body} inputRef={inputRef} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}
