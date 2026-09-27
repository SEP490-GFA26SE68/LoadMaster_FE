import { Badge } from '@/components/ui/Badge'
import { RoleLabel, UserAvatar } from '@/features/admin/user-look'
import { useT } from '@/lib/i18n'
import { ROLES } from '@/types/user'
import type { SheetSample } from '../design-system-api'
import { SheetCard } from '../SheetLayout'

const caption = 'm-0 mb-2 text-fine text-ink-3'

/**
 * Nhãn phiên bản (So sánh phương án, Planner), nhãn vai trò và ô chữ viết tắt của màn Người dùng, mã chuyến và biển số của chuyến
 * đầu kho. Ô chữ viết tắt vuông bo góc theo quyết định V2 (AGENTS mục 5), không tròn như bản mẫu.
 */
export function LabelsCard({ sample }: { sample: SheetSample | undefined }) {
  const t = useT()
  const plate = sample ? sample.trip.vehicleName.slice(sample.trip.vehicleName.lastIndexOf(' · ') + 3) : null
  return (
    <SheetCard title={t('designSystem.components.labels.title')} bodyClassName="gap-4">
      <div>
        <p className={caption}>{t('designSystem.components.labels.versions')}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge shape="tag" tone="cyan">{t('trips.compare.status.latest')}</Badge>
          <Badge shape="tag" tone="success">{t('trips.compare.status.approved')}</Badge>
          <Badge shape="tag" tone="warning">{t('trips.compare.status.stale')}</Badge>
          <Badge shape="tag" tone="azure">{t('viewer.plan.manuallyEdited')}</Badge>
          <Badge shape="tag" tone="mock">MOCK RESULT</Badge>
        </div>
      </div>
      <div>
        <p className={caption}>{t('designSystem.components.labels.roles')}</p>
        <div className="flex flex-wrap items-center gap-2">
          {ROLES.map((role) => <RoleLabel key={role} role={role} />)}
        </div>
      </div>
      <div>
        <p className={caption}>{t('designSystem.components.labels.people')}</p>
        <div className="flex flex-wrap items-center gap-2.5">
          {sample?.people.map((person, index) => (
            <span key={person.id} title={person.fullName}>
              <UserAvatar fullName={person.fullName} status={person.status} size={index === 2 ? 'lg' : 'md'} />
              <span className="sr-only">{person.fullName}</span>
            </span>
          ))}
          {sample ? <span className="font-mono text-caption text-ink-2">{sample.trip.id}</span> : null}
          {plate ? <span className="font-mono text-caption text-ink-2">{plate}</span> : null}
        </div>
      </div>
    </SheetCard>
  )
}
