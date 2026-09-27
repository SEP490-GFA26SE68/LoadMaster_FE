import { useEffect, useRef, useState, type RefObject } from 'react'

/** Trạng thái camera của hộp thoại quét QR (`QrScanDialog`, LM-104). */
export type CameraState = 'starting' | 'scanning' | 'unsupported' | 'denied' | 'failed'

/** Phần tối thiểu của Barcode Detection API mà hộp thoại dùng — thư viện DOM của TypeScript chưa khai báo. */
interface BarcodeDetectorLike {
  detect(source: HTMLVideoElement): Promise<readonly { rawValue: string }[]>
}
interface BarcodeDetectorClass {
  new (options: { formats: string[] }): BarcodeDetectorLike
  getSupportedFormats?: () => Promise<string[]>
}

const SCAN_INTERVAL_MS = 250

/** Quét bằng camera cần cả BarcodeDetector lẫn getUserMedia (Chrome Android có; Safari, Firefox và jsdom thì không). */
export function barcodeDetectorClass(): BarcodeDetectorClass | null {
  if (typeof window === 'undefined' || !('BarcodeDetector' in window)) return null
  if (typeof navigator.mediaDevices?.getUserMedia !== 'function') return null
  return (window as unknown as { BarcodeDetector: BarcodeDetectorClass }).BarcodeDetector
}

function cameraFailure(error: unknown): CameraState {
  return error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'SecurityError') ? 'denied' : 'failed'
}

/** Mở camera sau, đọc mã QR mỗi 250 ms. Tắt mọi track khi hộp thoại đóng (component gỡ ra). */
export function useQrCamera(videoRef: RefObject<HTMLVideoElement | null>, onDetected: (raw: string) => void, onUnavailable: () => void) {
  const [state, setState] = useState<CameraState>(() => (barcodeDetectorClass() ? 'starting' : 'unsupported'))
  const callbacks = useRef({ onDetected, onUnavailable })
  useEffect(() => {
    callbacks.current = { onDetected, onUnavailable }
  })

  useEffect(() => {
    const Detector = barcodeDetectorClass()
    if (!Detector) return
    let cancelled = false
    let stream: MediaStream | null = null
    let timer: number | undefined
    let busy = false

    function fail(next: CameraState) {
      if (cancelled) return
      setState(next)
      callbacks.current.onUnavailable()
    }

    async function start(DetectorClass: BarcodeDetectorClass) {
      try {
        const formats = await DetectorClass.getSupportedFormats?.()
        if (formats && !formats.includes('qr_code')) return fail('unsupported')
        const detector = new DetectorClass({ formats: ['qr_code'] })
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
        const video = videoRef.current
        if (cancelled || !video) return
        video.srcObject = stream
        await video.play()
        if (cancelled) return
        setState('scanning')
        timer = window.setInterval(() => {
          if (busy || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return
          busy = true
          detector
            .detect(video)
            .then((codes) => {
              const raw = codes[0]?.rawValue
              if (!cancelled && raw) callbacks.current.onDetected(raw)
            })
            // Một khung hình đọc lỗi (đang lấy nét, bị che) không phải sự cố: lần quét sau 250 ms thử lại.
            .catch(() => undefined)
            .finally(() => {
              busy = false
            })
        }, SCAN_INTERVAL_MS)
      } catch (error) {
        fail(cameraFailure(error))
      }
    }

    void start(Detector)
    return () => {
      cancelled = true
      window.clearInterval(timer)
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [videoRef])

  return state
}
