import { Trash2 } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/features/auth/AuthProvider'
import { dataErrorMessage, useT } from '@/lib/i18n'
import type { CargoPackage } from './backend/packages-api'
import { useDeleteCargoPackageMutation } from './backend/usePackagePoolQuery'

/** Server-backed deletion only. Keep the previous imported-only UI restriction (now PENDING).
 * The server rechecks the authenticated company and deletion rights; selection is never evidence of ownership.
 */
export function PackageDeleteAction({ pkg, onDeleted }: {
  pkg: Pick<CargoPackage, 'id' | 'packageCode' | 'status'>
  onDeleted: () => void
}) {
  const { user } = useAuth()
  const t = useT()
  const reasonId = useId()
  const [open, setOpen] = useState(false)
  const locked = useRef(false)
  const mounted = useRef(true)
  const remove = useDeleteCargoPackageMutation()
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  // packages.manage also belongs to Warehouse for editing; it must not grant the old Dispatcher delete action.
  if (user?.role !== 'dispatcher') return null
  const deletable = pkg.status === 'PENDING'
  const code = pkg.packageCode || pkg.id

  async function confirm() {
    if (locked.current || !deletable) return
    locked.current = true
    try {
      await remove.mutateAsync(pkg.id)
      if (mounted.current) {
        setOpen(false)
        toast.success(t('sourcing.detail.deleted', { code }))
        onDeleted()
      }
    } catch {
      // Keep the detail/confirmation open and show the server/network error; never remove optimistically.
    } finally { locked.current = false }
  }

  return <div className="flex flex-col items-start gap-1.5 border-t border-line-soft pt-4">
    <Button type="button" variant="secondary" size="sm" disabled={!deletable || remove.isPending}
      aria-describedby={deletable ? undefined : reasonId} onClick={() => { remove.reset(); setOpen(true) }}>
      <Trash2 strokeWidth={1.5} aria-hidden />{t('sourcing.detail.delete')}
    </Button>
    {!deletable ? <p id={reasonId} className="text-fine text-ink-3">{t('sourcing.detail.deleteOnlyPending')}</p> : null}
    <ConfirmDialog open={open} onOpenChange={next => {
      if (locked.current) return
      setOpen(next)
      if (!next) remove.reset()
    }} title={t('sourcing.detail.deleteTitle', { code })}
      description={remove.error ? dataErrorMessage(remove.error, t) : t('sourcing.detail.deleteDescription')}
      cancelLabel={t('sourcing.detail.deleteCancel')} confirmLabel={t('sourcing.detail.delete')}
      danger pending={remove.isPending} onConfirm={() => void confirm()} />
  </div>
}
