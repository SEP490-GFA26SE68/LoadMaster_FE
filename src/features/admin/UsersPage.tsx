import { Plus } from 'lucide-react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { PageHero } from '@/components/PageHero'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { useAuth } from '@/features/auth/AuthProvider'
import { useT } from '@/lib/i18n'
import { accountGuards } from './account-guards'
import { PermissionMatrix } from './PermissionMatrix'
import { TemporaryPasswordDialog } from './TemporaryPasswordDialog'
import { UserFormDialog } from './UserFormDialog'
import { UsersTable } from './UsersTable'
import { useUserActions } from './useUserActions'
import { useUsersQuery } from './useUsersQuery'

/**
 * Quản trị người dùng (LM-092, D-41, D-42): danh sách đọc từ kho qua `useUsersQuery` (tìm, lọc, sắp xếp, phân trang trên URL), menu
 * thao tác mỗi dòng, mật khẩu tạm hiện một lần, và tab "Ma trận quyền" chỉ đọc. Hành động chính duy nhất: thêm người dùng.
 * Bố cục V2: tab Tài khoản có ba ô số liệu trên một thẻ gồm thanh tìm/lọc và bảng; mỗi tab tự cuộn dưới thanh tab.
 */
export function UsersPage() {
  const t = useT()
  const { user: currentUser } = useAuth()
  const query = useUsersQuery()
  const actions = useUserActions()
  const users = query.data ?? []
  const { dialog } = actions
  const editing = dialog?.kind === 'edit' ? dialog.user : undefined

  return (
    <Tabs defaultValue="accounts" className="flex min-w-0 flex-1 flex-col">
      <PageHero
        overlap
        title={t('admin.users.title')}
        meta={query.data ? t('admin.users.count', { count: users.length }) : undefined}
        description={t('pageHero.users')}
        actions={
          <Button variant="primary" onClick={actions.openCreate}>
            <Plus strokeWidth={1.5} aria-hidden />
            {t('admin.users.form.createTitle')}
          </Button>
        }
      >
        {/* V2.3: tab nằm trong dải trời, dưới tiêu đề */}
        <TabsList tone="sky">
          <TabsTrigger value="accounts">{t('admin.users.tabs.accounts')}</TabsTrigger>
          <TabsTrigger value="permissions">{t('admin.users.tabs.permissions')}</TabsTrigger>
        </TabsList>
      </PageHero>

        <TabsContent value="accounts" className="sky-overlap min-h-0 flex-1 overflow-auto px-shell pb-6">
          {query.isPending ? (
            <div role="status" aria-label={t('admin.users.loading')} className="flex h-24 items-center justify-center"><Spinner /></div>
          ) : query.isError ? (
            <EmptyState
              title={t('admin.users.errorTitle')}
              description={t('admin.users.errorDescription')}
              action={<Button variant="secondary" onClick={() => void query.refetch()}>{t('admin.users.retry')}</Button>}
            />
          ) : (
            <UsersTable users={users} currentUserId={currentUser?.id ?? null} onAction={actions.handleAction} />
          )}
        </TabsContent>
        <TabsContent value="permissions" className="sky-overlap min-h-0 flex-1 overflow-auto px-shell pb-6">
          <PermissionMatrix />
        </TabsContent>

      {dialog?.kind === 'create' || dialog?.kind === 'edit' ? (
        <UserFormDialog
          key={editing?.id ?? 'new'}
          user={editing}
          roleBlock={editing ? accountGuards(editing, currentUser?.id ?? null, users).role : null}
          onClose={actions.close}
          onSubmit={(values) => (editing ? actions.submitEdit(editing, values) : actions.submitCreate(values))}
        />
      ) : null}
      <TemporaryPasswordDialog
        result={dialog?.kind === 'password' ? dialog.result : undefined}
        reason={dialog?.kind === 'password' ? dialog.reason : 'created'}
        onClose={actions.close}
      />
      {dialog?.kind === 'reset' ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => (open || actions.resetPending ? undefined : actions.close())}
          title={t('admin.users.reset.title', { name: dialog.user.fullName })}
          description={t('admin.users.reset.description')}
          cancelLabel={t('admin.users.reset.cancel')}
          confirmLabel={t('admin.users.reset.confirm')}
          pending={actions.resetPending}
          onConfirm={() => actions.confirmReset(dialog.user)}
        />
      ) : null}
      {dialog?.kind === 'delete' ? (
        <ConfirmDialog
          open
          danger
          onOpenChange={(open) => (open || actions.deletePending ? undefined : actions.close())}
          title={t('admin.users.remove.title', { name: dialog.user.fullName })}
          description={t('admin.users.remove.description')}
          cancelLabel={t('admin.users.remove.cancel')}
          confirmLabel={t('admin.users.remove.confirm')}
          pending={actions.deletePending}
          onConfirm={() => actions.confirmDelete(dialog.user)}
        />
      ) : null}
    </Tabs>
  )
}
