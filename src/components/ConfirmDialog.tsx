import type { ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { TriangleAlert } from 'lucide-react'
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'

/**
 * Hỏi xác nhận trước một thao tác không hoàn tác được: rời form xe/chuyến khi chưa lưu, xoá xe, thao tác trên tài khoản
 * (LM-041, LM-088, LM-092). Dùng Dialog của repo, không dùng `confirm()` của trình duyệt.
 * `pending`: nút xác nhận hiện đang xử lý và nút huỷ bị khoá — không huỷ giữa chừng một thao tác đã gửi (LM-100).
 * V2.3: thao tác nguy hiểm có ô icon đỏ ở đầu hộp thoại (`HopThoaiChuyen.jpg`).
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  cancelLabel,
  confirmLabel,
  danger = false,
  pending = false,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description: ReactNode
  cancelLabel: string
  confirmLabel: string
  danger?: boolean
  pending?: boolean
  onConfirm: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-120">
        <DialogHeader icon={danger ? TriangleAlert : undefined} tone="danger" title={title} description={description} className="pb-5" />
        <DialogFooter>
          <Button type="button" variant="secondary" disabled={pending} onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={danger ? 'danger' : 'primary'}
            loading={pending}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
