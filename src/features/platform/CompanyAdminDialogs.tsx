import { zodResolver } from '@hookform/resolvers/zod'
import { ShieldCheck, UserPen } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { SelectField } from '@/components/ui/SelectField'
import { BILLING_CAPABILITIES } from '@/features/billing/billing-api'
import { useFormat, useT, type MessageKey } from '@/lib/i18n'
import { SERVER_PLAN_STATUSES, type ServerPlanStatus } from './companies-server-api'
import type { CompanyAdminStatus, CompanyAdminUser } from './company-admins-api'
import { AgreementSection, FactSection, Facts } from './company-facts'
import { ServerPlanStatusBadge } from './server-companies-table'

export function CompanyAdminStatusBadge({ status }: { status: CompanyAdminStatus }) {
  const t = useT()
  return <Badge tone={status === 'ACTIVE' ? 'success' : 'neutral'} dot="solid">{t(`platform.companyAdmins.status.${status}`)}</Badge>
}

function planStatusOf(value: string | null): ServerPlanStatus | null {
  return SERVER_PLAN_STATUSES.find((status) => status === value) ?? null
}

/** Chi tiết một tài khoản Quản trị công ty: tài khoản, công ty, gói và số dư, thoả thuận dịch vụ của công ty. */
export function ViewAdminDialog({ admin, onClose, onEdit }: { admin: CompanyAdminUser | null; onClose: () => void; onEdit: (admin: CompanyAdminUser) => void }) {
  const t = useT()
  const format = useFormat()
  const missing = <span className="text-ink-3">{t('platform.companyAdmins.detail.missing')}</span>
  return (
    <Dialog open={admin !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="w-160">
        {admin === null ? null : (
          <>
            <DialogHeader icon={ShieldCheck} title={admin.fullName} description={admin.email} />
            <div className="flex max-h-[62vh] flex-col gap-5 overflow-y-auto px-7 py-5">
              <FactSection title={t('platform.companyAdmins.detail.account')}>
                <Facts
                  items={[
                    [t('platform.companyAdmins.detail.status'), <CompanyAdminStatusBadge key="fact-41" status={admin.status} />],
                    [t('platform.companyAdmins.detail.phone'), admin.phoneNumber ? <span key="fact-42" className="font-mono">{admin.phoneNumber}</span> : missing],
                    [t('platform.companyAdmins.detail.createdAt'), admin.createdAt ? format.date(admin.createdAt) : '—'],
                  ]}
                />
              </FactSection>
              <FactSection title={t('platform.companyAdmins.detail.company')}>
                <Facts
                  items={[
                    [t('platform.companyAdmins.detail.company'), admin.companyName ?? t('platform.companyAdmins.noCompany')],
                    [t('platform.companyAdmins.detail.companyCode'), admin.companyCode ? <span key="fact-51" className="font-mono">{admin.companyCode}</span> : '—'],
                    [t('platform.companyAdmins.detail.taxCode'), admin.taxCode ? <span key="fact-52" className="font-mono">{admin.taxCode}</span> : missing],
                  ]}
                />
              </FactSection>
              <FactSection title={t('platform.companyAdmins.detail.plan')}>
                {admin.planName === null ? (
                  <p className="m-0 text-body text-ink-2">{t('platform.companyAdmins.noPlan')}</p>
                ) : (
                  <Facts
                    items={[
                      [t('platform.companyAdmins.detail.planName'), admin.planName],
                      [t('platform.companyAdmins.detail.planStatus'), <ServerPlanStatusBadge key="fact-63" status={planStatusOf(admin.subscriptionStatus)} />],
                      [t('platform.companyAdmins.detail.expires'), admin.subscriptionExpiresAt ? format.date(admin.subscriptionExpiresAt) : '—'],
                      [t('platform.companyAdmins.detail.balance'), admin.creditBalance === null ? '—' : <span key="fact-65" className="font-mono tabular-nums">{format.integer(admin.creditBalance)}</span>],
                    ]}
                  />
                )}
              </FactSection>
              {BILLING_CAPABILITIES.agreements && admin.companyId !== null ? <AgreementSection companyId={String(admin.companyId)} /> : null}
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="secondary">{t('platform.companyAdmins.detail.close')}</Button>
              </DialogClose>
              <Button variant="primary" onClick={() => onEdit(admin)}>{t('platform.companyAdmins.detail.edit')}</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

const ERRORS = {
  fullNameRequired: 'platform.companyAdmins.form.errors.fullNameRequired',
  fullNameTooLong: 'platform.companyAdmins.form.errors.fullNameTooLong',
  phoneInvalid: 'platform.companyAdmins.form.errors.phoneInvalid',
} as const satisfies Record<string, MessageKey>

const adminFormSchema = z.object({
  fullName: z.string().trim().min(1, ERRORS.fullNameRequired).max(100, ERRORS.fullNameTooLong),
  phoneNumber: z.string().trim().refine((value) => value === '' || /^\+?\d{9,15}$/.test(value), ERRORS.phoneInvalid),
  status: z.enum(['ACTIVE', 'LOCKED']),
})

export type AdminFormValues = z.output<typeof adminFormSchema>

/** Sửa họ tên, số điện thoại và khoá / mở khoá; email đăng nhập, vai trò và công ty giữ nguyên. */
export function EditAdminDialog({ admin, pending, onClose, onSave }: {
  admin: CompanyAdminUser
  pending: boolean
  onClose: () => void
  onSave: (values: AdminFormValues) => void
}) {
  const t = useT()
  const form = useForm<z.input<typeof adminFormSchema>, unknown, AdminFormValues>({
    resolver: zodResolver(adminFormSchema),
    defaultValues: { fullName: admin.fullName, phoneNumber: admin.phoneNumber ?? '', status: admin.status },
  })
  const { errors } = form.formState
  const message = (key: string | undefined) => (key === undefined ? undefined : t(key as MessageKey))
  return (
    <Dialog open onOpenChange={(open) => (open || pending ? undefined : onClose())}>
      <DialogContent className="w-120">
        <form noValidate onSubmit={form.handleSubmit(onSave)}>
          <DialogHeader
            icon={UserPen}
            title={t('platform.companyAdmins.form.title', { name: admin.fullName })}
            description={t('platform.companyAdmins.form.description', { email: admin.email })}
          />
          <div className="flex flex-col gap-4 px-7 py-5">
            <Input label={t('platform.companyAdmins.form.fullName')} required error={message(errors.fullName?.message)} {...form.register('fullName')} />
            <Input label={t('platform.companyAdmins.form.phone')} type="tel" inputMode="tel" error={message(errors.phoneNumber?.message)} {...form.register('phoneNumber')} />
            <SelectField
              control={form.control}
              name="status"
              label={t('platform.companyAdmins.form.status')}
              hint={t('platform.companyAdmins.form.lockHint')}
              options={(['ACTIVE', 'LOCKED'] as const).map((status) => ({ value: status, label: t(`platform.companyAdmins.status.${status}`) }))}
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary" disabled={pending}>{t('platform.companyAdmins.form.cancel')}</Button>
            </DialogClose>
            <Button type="submit" variant="primary" loading={pending}>{t('platform.companyAdmins.form.save')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
