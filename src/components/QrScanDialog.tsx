import { zodResolver } from '@hookform/resolvers/zod'
import { ScanLine } from 'lucide-react'
import { useId, useMemo, useRef, type RefObject } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { useT, type MessageKey } from '@/lib/i18n'
import { normalizeQrToken } from './qr-matrix'
import { barcodeDetectorClass, useQrCamera, type CameraState } from './useQrCamera'

export type QrScanOption = { token: string; label: string; description?: string }

type QrScanDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  /** Nhận token đã chuẩn hoá (`normalizeQrToken`) — từ camera, ô nhập tay hoặc danh sách chọn. */
  onScan: (token: string) => void
  options?: readonly QrScanOption[]
  error?: string | null
  pending?: boolean
}

const CAMERA_STATUS = {
  starting: 'qr.scan.camera.starting',
  scanning: 'qr.scan.camera.scanning',
  unsupported: 'qr.scan.camera.unsupported',
  denied: 'qr.scan.camera.denied',
  failed: 'qr.scan.camera.failed',
} as const satisfies Record<CameraState, MessageKey>

type ManualValues = { token: string }

/**
 * Thân hộp thoại nằm trong `DialogContent` nên gắn/gỡ theo lúc mở/đóng: camera tắt, ô nhập và mã vừa quét về trống mỗi lần mở.
 */
function QrScanBody({
  contentRef,
  inputRef,
  title,
  description,
  onScan,
  options,
  error,
  pending = false,
  onClose,
}: Omit<QrScanDialogProps, 'open' | 'onOpenChange'> & {
  contentRef: RefObject<HTMLDivElement | null>
  inputRef: RefObject<HTMLInputElement | null>
  onClose: () => void
}) {
  const t = useT()
  const pickId = useId()
  const videoRef = useRef<HTMLVideoElement>(null)
  const lastScanned = useRef<string | null>(null)
  const schema = useMemo(
    () => z.object({ token: z.string().refine((value) => normalizeQrToken(value) !== '', t('qr.scan.manualRequired')) }),
    [t],
  )
  const form = useForm<ManualValues>({ resolver: zodResolver(schema), defaultValues: { token: '' } })
  const { ref: registerRef, ...tokenField } = form.register('token')

  // Mã sai vẫn nằm trước camera thì không gửi lại liên tục; đưa mã khác vào khung là gửi ngay.
  function handleDetected(raw: string) {
    const token = normalizeQrToken(raw)
    if (!token || pending || token === lastScanned.current) return
    lastScanned.current = token
    onScan(token)
  }

  // Camera hỏng hoặc bị từ chối sau khi mở: đưa con trỏ vào ô nhập, trừ khi người dùng đã tự chuyển sang chỗ khác.
  function handleUnavailable() {
    const active = document.activeElement
    if (!active || active === document.body || active === contentRef.current) inputRef.current?.focus()
  }

  const camera = useQrCamera(videoRef, handleDetected, handleUnavailable)
  const touch = 'pointer-coarse:h-14 pointer-coarse:text-body-lg'

  return (
    <>
      <DialogHeader icon={ScanLine} title={title} description={description} />
      <div className="flex flex-col gap-4 px-7 py-5">
        {camera === 'starting' || camera === 'scanning' ? (
          <video ref={videoRef} muted playsInline aria-hidden className="aspect-video w-full rounded-lg bg-panel-dark object-cover" />
        ) : null}
        <p role="status" className="text-small text-ink-2">
          {t(CAMERA_STATUS[camera])}
        </p>

        <form noValidate className="flex flex-col gap-2.5" onSubmit={form.handleSubmit(({ token }) => onScan(normalizeQrToken(token)))}>
          <Input
            label={t('qr.scan.manualLabel')}
            hint={t('qr.scan.manualHint')}
            error={form.formState.errors.token?.message}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className={`font-mono ${touch}`}
            {...tokenField}
            ref={(element) => {
              registerRef(element)
              inputRef.current = element
            }}
          />
          <Button type="submit" className={`self-end ${touch}`} loading={pending}>
            {t('qr.scan.submit')}
          </Button>
        </form>

        {error ? (
          <p role="alert" className="text-fine text-danger">
            {error}
          </p>
        ) : null}

        {options && options.length > 0 ? (
          <section aria-labelledby={pickId} className="flex flex-col gap-2">
            <h3 id={pickId} className="text-small font-semibold text-ink-2">
              {t('qr.scan.pickTitle')}
            </h3>
            <ul className="flex max-h-64 flex-col gap-1.5 overflow-y-auto p-0.5">
              {options.map((option) => (
                <li key={option.token}>
                  <Button
                    type="button"
                    variant="secondary"
                    block
                    disabled={pending}
                    onClick={() => onScan(option.token)}
                    className="h-auto min-h-11 flex-col items-start justify-center gap-0.5 py-2 text-left whitespace-normal pointer-coarse:min-h-14 pointer-coarse:text-body-lg"
                  >
                    <span className="font-semibold">{option.label}</span>
                    {option.description ? <span className="text-small font-normal text-ink-3">{option.description}</span> : null}
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
      <DialogFooter>
        <Button type="button" variant="secondary" className={touch} onClick={onClose}>
          {t('qr.scan.close')}
        </Button>
      </DialogFooter>
    </>
  )
}

/**
 * Hộp thoại quét mã QR (LM-104). Có camera và BarcodeDetector thì quét trực tiếp; không có (Safari, Firefox, máy bàn), bị từ chối
 * quyền hay camera hỏng thì dòng trạng thái nói rõ và con trỏ vào ô nhập tay. Ô nhập tay và danh sách chọn (nếu có) luôn hiện —
 * quét được hay không, người dùng vẫn đi tiếp được. Khi camera đang chạy, con trỏ đứng ở hộp thoại chứ không ở ô nhập để bàn
 * phím ảo không che khung hình.
 */
export function QrScanDialog({ open, onOpenChange, ...body }: QrScanDialogProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={contentRef}
        className="w-120"
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          if (barcodeDetectorClass()) contentRef.current?.focus()
          else inputRef.current?.focus()
        }}
      >
        <QrScanBody {...body} contentRef={contentRef} inputRef={inputRef} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}
