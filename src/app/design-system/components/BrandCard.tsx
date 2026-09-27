import { Logo } from '@/components/brand/Logo'
import { Lumo, LUMO_POSES, type LumoPose } from '@/components/brand/Lumo'
import { LogoMark } from '@/components/brand/LogoMark'
import { useT } from '@/lib/i18n'
import { SheetCard, SkyStage } from '../SheetLayout'

const caption = 'm-0 mb-2 text-fine text-ink-3'

/** Ba màu gốc của biểu tượng (LM-105). Hex là mã màu, không dịch. */
const SWATCHES = [
  { key: 'lid', token: '--logo-sky', hex: '#0196FD' },
  { key: 'letterL', token: '--logo-blue', hex: '#0052FC' },
  { key: 'letterN', token: '--logo-navy', hex: '#00276F' },
] as const

const SIZES = ['size-4', 'size-6', 'size-8', 'size-12'] as const

const POSES = Object.keys(LUMO_POSES) as LumoPose[]

/**
 * Thương hiệu (LM-105): bộ ghép logo trên nền sáng và trên dải trời, biểu tượng ở các cỡ dùng trong app (16 favicon · 24 · 32 thanh
 * điều hướng · 48) và bản một màu cho giấy in, ba màu gốc và luật dùng.
 */
export function BrandCard() {
  const t = useT()
  return (
    <SheetCard title={t('designSystem.components.brand.title')} meta={t('designSystem.components.brand.meta')} bodyClassName="gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="grid min-h-28 place-items-center rounded-lg border border-line-soft bg-bg p-4">
          <Logo tagline />
        </div>
        <SkyStage className="grid min-h-28 place-items-center">
          <Logo tone="dark" tagline />
        </SkyStage>
      </div>

      <div>
        <p className={caption}>{t('designSystem.components.brand.sizes')}</p>
        <div className="flex flex-wrap items-end gap-4">
          {SIZES.map((size) => <LogoMark key={size} className={size} />)}
          <span className="h-8 w-px bg-line-soft" aria-hidden />
          <LogoMark tone="mono" className="size-8 text-ink-strong" />
          <SkyStage className="p-2">
            <LogoMark tone="dark" className="size-8" />
          </SkyStage>
        </div>
      </div>

      <div>
        <p className={caption}>{t('designSystem.components.brand.colors')}</p>
        <ul className="m-0 flex list-none flex-wrap gap-4 p-0">
          {SWATCHES.map(({ key, token, hex }) => (
            <li key={key} className="flex items-center gap-2.5">
              <span aria-hidden className="size-8 rounded-md" style={{ background: `var(${token})` }} />
              <span className="flex flex-col">
                <span className="text-small font-medium text-ink-1">{t(`designSystem.components.brand.swatches.${key}`)}</span>
                <span className="font-mono text-caption text-ink-3">{hex}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className={caption}>{t('designSystem.components.brand.lumo')}</p>
        <ul className="m-0 grid list-none grid-cols-4 gap-2 p-0 sm:grid-cols-7">
          {POSES.map((pose) => (
            <li key={pose} className="flex flex-col items-center gap-1 text-center">
              <Lumo pose={pose} className="size-16" />
              <span className="text-fine text-ink-2">{t(`designSystem.components.brand.poses.${pose}`)}</span>
            </li>
          ))}
        </ul>
      </div>

      <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-small text-ink-2">
        <li>{t('designSystem.components.brand.rules.color')}</li>
        <li>{t('designSystem.components.brand.rules.dark')}</li>
        <li>{t('designSystem.components.brand.rules.space')}</li>
        <li>{t('designSystem.components.brand.rules.tagline')}</li>
        <li>{t('designSystem.components.brand.rules.lumo')}</li>
      </ul>
    </SheetCard>
  )
}
