import { Plus, RotateCcw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Banner } from '@/components/Banner'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DataTable } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { PageHero } from '@/components/PageHero'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { TemporaryPasswordDialog } from '@/features/admin/TemporaryPasswordDialog'
import { dataErrorMessage, useT } from '@/lib/i18n'
import type { TemporaryPassword } from '@/lib/mock-db'
import type { ServerCompany, ServerCompanyRow } from './companies-server-api'
import { CompanyAdminsTab } from './CompanyAdminsTab'
import { ServerCompanyFormDialog, type AdminFailure } from './ServerCompanyFormDialog'
import { createServerCompanyColumns, ServerCompaniesTableContext, type ServerCompaniesTableValue } from './server-companies-table'
import { toNewServerCompany, toServerCompanyAdmin, toServerCompanyInput, type ServerCompanyFormValues, type ServerCompanyTaken } from './server-company-form'
import {
  useCreateServerCompanyAdminMutation,
  useCreateServerCompanyMutation,
  useServerCompaniesQuery,
  useServerCompanyStatusMutation,
  useUpdateServerCompanyMutation,
} from './useCompaniesQuery'
import { ViewCompanyDetailsDialog } from './ViewCompanyDetailsDialog'

type Dialog =
  | { kind: 'create' }
  | { kind: 'view'; row: ServerCompanyRow }
  | { kind: 'edit'; company: ServerCompany }
  | { kind: 'admin'; company: ServerCompany; failure?: AdminFailure }
  | { kind: 'status'; company: ServerCompany; next: 'ACTIVE' | 'SUSPENDED' }
  | { kind: 'password'; result: TemporaryPassword }

/**
 * Công ty `/nen-tang/cong-ty` khi nối backend (FE-8-06). Cột theo dữ liệu backend có: mã, tên, mã số thuế, email thanh toán, gói (từ hợp
 * đồng), số người dùng, trạng thái, ngày tạo — backend chưa lưu địa chỉ, số điện thoại, kho xuất phát nên màn không có. Một nút chính
 * "Tạo công ty": tạo công ty rồi tạo quản trị công ty đầu tiên, hiện mật khẩu tạm một lần. Bước tạo quản trị hỏng thì hộp thoại chuyển
 * sang tạo riêng quản trị cho công ty vừa có (backend chưa xoá được công ty); công ty chưa có quản trị cũng tạo được từ menu của dòng.
 * Tạm ngưng / mở lại chỉ ghi trạng thái — hộp xác nhận nói rõ backend chưa chặn đăng nhập. "Xem chi tiết" của dòng mở hồ sơ, gói và thoả
 * thuận dịch vụ (`ViewCompanyDetailsDialog`). Tab thứ hai (`?tab=quan-tri`) là tài khoản Quản trị công ty của mọi công ty (`CompanyAdminsTab`).
 */
const ADMINS_TAB = 'quan-tri'

export function ServerCompaniesPage() {
  const t = useT()
  const query = useServerCompaniesQuery()
  const create = useCreateServerCompanyMutation()
  const createAdmin = useCreateServerCompanyAdminMutation()
  const update = useUpdateServerCompanyMutation()
  const status = useServerCompanyStatusMutation()
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === ADMINS_TAB ? 'admins' : 'companies'

  function handleTab(next: string) {
    setParams((current) => {
      const nextParams = new URLSearchParams(current)
      if (next === 'admins') nextParams.set('tab', ADMINS_TAB)
      else nextParams.delete('tab')
      return nextParams
    }, { replace: true })
  }

  const list = query.data
  const rows = useMemo(() => list?.rows ?? [], [list])
  const taken = useMemo<ServerCompanyTaken>(
    () => ({ codes: rows.map((row) => row.company.code), taxCodes: rows.map((row) => row.company.taxCode), emails: list?.takenEmails ?? [] }),
    [rows, list],
  )
  const columns = useMemo(() => createServerCompanyColumns(t), [t])
  const context: ServerCompaniesTableValue = {
    plansLoaded: list?.plansLoaded ?? true,
    usersLoaded: list?.usersLoaded ?? true,
    onView: (row) => setDialog({ kind: 'view', row }),
    onEdit: (row) => setDialog({ kind: 'edit', company: row.company }),
    onCreateAdmin: (row) => setDialog({ kind: 'admin', company: row.company }),
    onStatus: (row, next) => setDialog({ kind: 'status', company: row.company, next }),
  }

  async function handleSubmit(current: Dialog, values: ServerCompanyFormValues) {
    if (current.kind === 'edit') {
      const company = await update.mutateAsync({ current: current.company, input: toServerCompanyInput(values) })
      toast.success(t('companies.saved', { name: company.name }))
      setDialog(null)
    } else if (current.kind === 'admin') {
      const result = await createAdmin.mutateAsync({ companyId: current.company.id, admin: toServerCompanyAdmin(values) })
      toast.success(t('companies.server.adminCreated', { name: current.company.name }))
      setDialog({ kind: 'password', result })
    } else {
      const admin = toServerCompanyAdmin(values)
      const result = await create.mutateAsync({ company: toNewServerCompany(values), admin })
      if ('admin' in result) {
        toast.success(t('companies.created', { name: result.company.name }))
        setDialog({ kind: 'password', result: result.admin })
      } else {
        // Công ty đã có trên máy chủ: hộp thoại nói vậy và chỉ còn tạo lại quản trị
        setDialog({ kind: 'admin', company: result.company, failure: { error: result.adminError, admin } })
      }
    }
  }

  async function handleStatus(current: Extract<Dialog, { kind: 'status' }>) {
    try {
      const company = await status.mutateAsync({ id: current.company.id, status: current.next })
      toast.success(t(current.next === 'SUSPENDED' ? 'companies.server.suspend.done' : 'companies.server.reactivate.done', { name: company.name }))
      setDialog(null)
    } catch (error) {
      toast.error(dataErrorMessage(error, t))
    }
  }

  const addButton = (
    <Button variant="primary" onClick={() => setDialog({ kind: 'create' })}>
      <Plus strokeWidth={1.5} aria-hidden />
      {t('companies.add')}
    </Button>
  )
  const partial = list !== undefined && (!list.plansLoaded || !list.usersLoaded)
  const statusCopy = dialog?.kind === 'status' ? (dialog.next === 'SUSPENDED' ? 'suspend' : 'reactivate') : null

  return (
    <Tabs value={tab} onValueChange={handleTab} className="flex min-w-0 flex-1 flex-col">
      <PageHero
        title={t('companies.title')}
        meta={query.isSuccess ? t('companies.count', { count: rows.length }) : undefined}
        description={t('pageHero.companiesServer')}
        actions={addButton}
      >
        <TabsList tone="sky" aria-label={t('companies.server.tabs.label')}>
          <TabsTrigger value="companies">{t('companies.server.tabs.companies')}</TabsTrigger>
          <TabsTrigger value="admins">{t('companies.server.tabs.admins')}</TabsTrigger>
        </TabsList>
      </PageHero>
      <TabsContent value="admins" className="min-h-0 flex-1 overflow-auto px-shell py-6">
        <CompanyAdminsTab />
      </TabsContent>
      <TabsContent value="companies" className="min-h-0 flex-1 overflow-auto px-shell py-6">
        {query.isPending ? (
          <div role="status" aria-label={t('companies.loading')} className="flex justify-center py-16"><Spinner /></div>
        ) : query.isError ? (
          <EmptyState
            mascot="error"
            title={dataErrorMessage(query.error, t)}
            action={<Button variant="secondary" onClick={() => void query.refetch()}><RotateCcw strokeWidth={1.5} />{t('companies.retry')}</Button>}
          />
        ) : rows.length === 0 ? (
          <EmptyState mascot="empty" title={t('companies.empty')} description={t('companies.emptyDescription')} />
        ) : (
          <div className="flex flex-col gap-4">
            {partial ? (
              <Banner
                tone="warning"
                action={<Button variant="ghost" size="sm" onClick={() => void query.refetch()}>{t('companies.server.partial.retry')}</Button>}
              >
                {[list.plansLoaded ? null : t('companies.server.partial.plans'), list.usersLoaded ? null : t('companies.server.partial.users')].filter(Boolean).join(' ')}
              </Banner>
            ) : null}
            <ServerCompaniesTableContext value={context}>
              <Card className="relative flex-none overflow-hidden">
                <DataTable data={rows} columns={columns} getRowId={(row) => row.company.id} density="spacious" appearance="paper" />
              </Card>
            </ServerCompaniesTableContext>
          </div>
        )}
      </TabsContent>

      <ViewCompanyDetailsDialog
        row={dialog?.kind === 'view' ? dialog.row : null}
        plansLoaded={list?.plansLoaded ?? true}
        onClose={() => setDialog(null)}
        onEdit={(row) => setDialog({ kind: 'edit', company: row.company })}
      />
      {dialog?.kind === 'create' || dialog?.kind === 'edit' || dialog?.kind === 'admin' ? (
        <ServerCompanyFormDialog
          key={dialog.kind === 'create' ? 'new' : `${dialog.kind}-${dialog.company.id}`}
          mode={dialog.kind}
          company={dialog.kind === 'create' ? undefined : dialog.company}
          failure={dialog.kind === 'admin' ? dialog.failure : undefined}
          taken={taken}
          onClose={() => setDialog(null)}
          onSubmit={(values) => handleSubmit(dialog, values)}
        />
      ) : null}
      <ConfirmDialog
        open={dialog?.kind === 'status'}
        onOpenChange={(open) => (open || status.isPending ? undefined : setDialog(null))}
        title={dialog?.kind === 'status' && statusCopy ? t(`companies.server.${statusCopy}.title`, { name: dialog.company.name }) : ''}
        description={statusCopy ? t(`companies.server.${statusCopy}.description`) : ''}
        cancelLabel={t('companies.server.cancel')}
        confirmLabel={statusCopy ? t(`companies.server.${statusCopy}.confirm`) : ''}
        danger={statusCopy === 'suspend'}
        pending={status.isPending}
        onConfirm={() => (dialog?.kind === 'status' ? void handleStatus(dialog) : undefined)}
      />
      <TemporaryPasswordDialog result={dialog?.kind === 'password' ? dialog.result : undefined} reason="created" onClose={() => setDialog(null)} />
    </Tabs>
  )
}
