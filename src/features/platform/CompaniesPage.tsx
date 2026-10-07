import { Plus, RotateCcw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { DataTable } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { PageHero } from '@/components/PageHero'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { TemporaryPasswordDialog } from '@/features/admin/TemporaryPasswordDialog'
import { dataErrorMessage, useT } from '@/lib/i18n'
import type { Company, CompanyOverview, TemporaryPassword } from '@/lib/mock-db'
import { toCompanyInfo, toNewCompany } from './company-form'
import { CompanyFormDialog } from './CompanyFormDialog'
import { CompaniesTableContext, createCompanyColumns, type CompaniesTableValue } from './companies-table'
import { useCompaniesQuery, useCreateCompanyMutation, useUpdateCompanyMutation } from './useCompaniesQuery'

type Dialog = { kind: 'create' } | { kind: 'edit'; company: Company } | { kind: 'password'; result: TemporaryPassword }

/**
 * Công ty `/nen-tang/cong-ty` (FE-8-06, D-65) — màn chính của quản trị hệ thống (`companies.manage`). Bảng công ty: tên, gói, trạng thái
 * gói, số người dùng; sửa thông tin và kho xuất phát ở `CompanyFormDialog`. Một nút chính: "Tạo công ty" — tạo công ty chưa có gói cùng
 * Quản trị công ty đầu tiên, rồi hiện mật khẩu tạm của tài khoản đó đúng một lần (`TemporaryPasswordDialog`, như màn Người dùng).
 */
export function CompaniesPage() {
  const t = useT()
  const query = useCompaniesQuery()
  const create = useCreateCompanyMutation()
  const update = useUpdateCompanyMutation()
  const [dialog, setDialog] = useState<Dialog | null>(null)

  const rows = useMemo(() => query.data ?? [], [query.data])
  const columns = useMemo(() => createCompanyColumns(t), [t])
  const context: CompaniesTableValue = { onEdit: (row: CompanyOverview) => setDialog({ kind: 'edit', company: row.company }) }

  const addButton = (
    <Button variant="primary" onClick={() => setDialog({ kind: 'create' })}>
      <Plus strokeWidth={1.5} aria-hidden />
      {t('companies.add')}
    </Button>
  )
  const showTable = query.isSuccess && rows.length > 0

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PageHero
        overlap={showTable}
        title={t('companies.title')}
        meta={query.isSuccess ? t('companies.count', { count: rows.length }) : undefined}
        description={t('pageHero.companies')}
        actions={addButton}
      />
      <div className={showTable ? 'sky-overlap min-h-0 flex-1 overflow-auto px-shell pb-6' : 'min-h-0 flex-1 overflow-auto px-shell py-6'}>
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
          <CompaniesTableContext value={context}>
            <Card className="relative flex-none overflow-hidden">
              <DataTable data={rows} columns={columns} getRowId={(row) => row.company.id} density="spacious" appearance="paper" />
            </Card>
          </CompaniesTableContext>
        )}
      </div>

      {dialog?.kind === 'create' || dialog?.kind === 'edit' ? (
        <CompanyFormDialog
          key={dialog.kind === 'edit' ? dialog.company.id : 'new'}
          company={dialog.kind === 'edit' ? dialog.company : undefined}
          onClose={() => setDialog(null)}
          onSubmit={async (values) => {
            if (dialog.kind === 'edit') {
              const company = await update.mutateAsync({ id: dialog.company.id, input: toCompanyInfo(values) })
              toast.success(t('companies.saved', { name: company.name }))
              setDialog(null)
              return
            }
            const { company, ...result } = await create.mutateAsync(toNewCompany(values))
            toast.success(t('companies.created', { name: company.name }))
            setDialog({ kind: 'password', result })
          }}
        />
      ) : null}
      <TemporaryPasswordDialog
        result={dialog?.kind === 'password' ? dialog.result : undefined}
        reason="created"
        onClose={() => setDialog(null)}
      />
    </div>
  )
}
