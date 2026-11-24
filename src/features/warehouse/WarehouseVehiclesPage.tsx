import { Truck } from 'lucide-react'
import { TouchTopBar } from '@/components/TouchTopBar'
import { LanguageSwitch } from '@/components/LanguageSwitch'
import { AccountMenu } from '@/features/auth/AccountMenu'
import { ExitIconButton } from '@/features/auth/ExitControl'
import { TouchAssistant } from '@/features/marketing/assistant/TouchAssistant'
import { useT } from '@/lib/i18n'
import { WarehouseVehicleCheckIn } from './WarehouseVehicleCheckIn'
import { WarehouseWorkspaceTabs } from './WarehouseWorkspaceTabs'
import { useWarehouseCapabilities } from './useServerWarehouseQuery'

export function WarehouseVehiclesPage() {
  const t = useT()
  const caps = useWarehouseCapabilities()
  return <div className="flex h-dvh min-w-0 flex-col bg-app text-body-lg">
    <TouchTopBar wrap leading={<ExitIconButton tone="sky" screenHome="/kho/xe" label={t('warehouse.presence.backToTrips')} iconClassName="size-7" />}
      assistant={<TouchAssistant />}
      trailing={<><LanguageSwitch size="touch" tone="sky" /><AccountMenu tone="sky" /></>}
      below={<WarehouseWorkspaceTabs />}>
      <Truck className="size-8 shrink-0 text-sky-text" />
      <h1 className="truncate font-display text-h1 font-bold text-sky-text">{t('warehouse.presence.pageTitle')}</h1>
    </TouchTopBar>
    <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
      {caps.backend ? <WarehouseVehicleCheckIn /> : <p role="status">{t('warehouse.presence.backendOnly')}</p>}
    </main>
  </div>
}
