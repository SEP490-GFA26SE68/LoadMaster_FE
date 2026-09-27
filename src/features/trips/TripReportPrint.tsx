import { useEffect, useState, type ReactNode } from 'react'
import { createPortal, flushSync } from 'react-dom'

/**
 * Bản in của báo cáo chuyến (LM-104). Khung ứng dụng cao đúng khung nhìn và tự cuộn vùng nội dung (AGENTS mục 5), nên in thẳng màn
 * chỉ ra phần đang thấy cùng thanh điều hướng. Thay vào đó, lúc trình duyệt chuẩn bị in (`beforeprint` — nút "In báo cáo" hay Ctrl+P)
 * báo cáo được dựng thêm một bản phẳng gắn thẳng vào `<body>`, và `@media print` ẩn `#root`. `flushSync` để bản in có trong DOM trước
 * khi trình duyệt chụp trang; in xong (`afterprint`) thì gỡ. Trên màn hình bản này luôn ẩn (`print:block`).
 */
export function usePrinting(): boolean {
  const [printing, setPrinting] = useState(false)
  useEffect(() => {
    const before = () => flushSync(() => setPrinting(true))
    const after = () => setPrinting(false)
    window.addEventListener('beforeprint', before)
    window.addEventListener('afterprint', after)
    return () => {
      window.removeEventListener('beforeprint', before)
      window.removeEventListener('afterprint', after)
    }
  }, [])
  return printing
}

const PRINT_CSS = '@media print { body > #root { display: none !important; } @page { margin: 12mm; } }'

export function TripReportPrint({ children }: { children: ReactNode }) {
  return createPortal(
    <div data-print-report className="hidden bg-bg text-ink-1 print:block">
      <style>{PRINT_CSS}</style>
      <div className="flex flex-col gap-4 p-0">{children}</div>
    </div>,
    document.body,
  )
}
