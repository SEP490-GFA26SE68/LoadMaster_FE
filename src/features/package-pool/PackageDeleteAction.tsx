import { Trash2 } from 'lucide-react'
import { useId, useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Button } from '@/components/ui/Button'
import { dataErrorMessage, useT } from '@/lib/i18n'
import type { Package } from '@/lib/mock-db'
import { useDeletePackageMutation } from './usePackagePoolQuery'

/**
 * "Xoá kiện" ở panel chi tiết — chỉ khi nối backend (kho mẫu giữ mọi kiện để còn lịch sử) và chỉ điều phối viên. Chỉ kiện Đã nhập xoá
 * được: kiện đã vào chuyến thì nút mờ kèm lý do ngay dưới (backend chưa tự chặn). Hỏi lại trước khi xoá; máy chủ từ chối thì câu lỗi thay
 * mô tả của hộp thoại. Xoá xong `onDeleted` (panel đóng) và một toast — kiện biến khỏi bảng.
 */
export function PackageDeleteAction({ pkg, onDeleted }: { pkg: Package; onDeleted: () => void }) {
  const t = useT()
  const reasonId = useId()
  const [open, setOpen] = useState(false)
  const remove = useDeletePackageMutation()
  const deletable = pkg.status === 'IMPORTED'

  async function handleConfirm() {
    try {
      await remove.mutateAsync(pkg.id)
    } catch {
      return // câu lỗi hiện trong hộp thoại
    }
    // Panel có thể đã gỡ khỏi màn khi danh sách mới về: toast và đóng panel vẫn chạy
    setOpen(false)
    toast.success(t('sourcing.detail.deleted', { code: pkg.packageCode }))
    onDeleted()
  }

  return (
    <div className="flex flex-col items-start gap-1.5 border-t border-line-soft pt-4">
      <Button variant="secondary" size="sm" disabled={!deletable} aria-describedby={deletable ? undefined : reasonId} onClick={() => setOpen(true)}>
        <Trash2 strokeWidth={1.5} />
        {t('sourcing.detail.delete')}
      </Button>
      {deletable ? null : <p id={reasonId} className="text-fine text-ink-3">{t('sourcing.detail.deleteOnlyImported')}</p>}
      <ConfirmDialog
        open={open}
        onOpenChange={(next) => {
          if (next || remove.isPending) return
          setOpen(false)
          remove.reset()
        }}
        title={t('sourcing.detail.deleteTitle', { code: pkg.packageCode })}
        description={remove.error ? dataErrorMessage(remove.error, t) : t('sourcing.detail.deleteDescription')}
        cancelLabel={t('sourcing.detail.deleteCancel')}
        confirmLabel={t('sourcing.detail.deleteConfirm')}
        danger
        pending={remove.isPending}
        onConfirm={() => void handleConfirm()}
      />
    </div>
  )
}
