import { useId, useState, type ChangeEvent } from 'react'
import { ImagePlus, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useT } from '@/lib/i18n'
import { MAX_SUPPORT_IMAGES } from './support-chat'

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Could not read image'))
    reader.onerror = () => reject(reader.error ?? new Error('Could not read image'))
    reader.onabort = () => reject(new Error('Image read was cancelled'))
    reader.readAsDataURL(file)
  })
}

export function SupportImagePicker({ images, onChange, disabled = false }: {
  images: readonly string[]
  onChange: (images: string[]) => void
  disabled?: boolean
}) {
  const t = useT()
  const inputId = useId()
  const [error, setError] = useState<string | null>(null)

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? [])
    event.currentTarget.value = ''
    if (files.length === 0) return
    if (images.length + files.length > MAX_SUPPORT_IMAGES) {
      setError(t('support.attachments.maxReached', { max: MAX_SUPPORT_IMAGES }))
      return
    }
    if (files.some((file) => !file.type.startsWith('image/'))) {
      setError(t('support.attachments.invalidType'))
      return
    }

    setError(null)
    try {
      onChange([...images, ...(await Promise.all(files.map(readAsDataUrl)))])
    } catch {
      setError(t('support.attachments.readFailed'))
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <label
          htmlFor={inputId}
          className={`inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-bg px-3 py-2 text-small font-medium text-text shadow-e1 hover:bg-surface ${disabled ? 'pointer-events-none opacity-50' : ''}`}
        >
          <ImagePlus className="size-4" strokeWidth={1.5} aria-hidden />
          {t('support.attachments.choose')}
          <input
            id={inputId}
            type="file"
            accept="image/*"
            multiple
            aria-label={t('support.attachments.choose')}
            disabled={disabled}
            className="sr-only"
            onChange={(event) => void handleFiles(event)}
          />
        </label>
        <span className="text-caption text-ink-3">{t('support.attachments.count', { count: images.length, max: MAX_SUPPORT_IMAGES })}</span>
      </div>
      <p className="m-0 text-caption text-ink-3">{t('support.attachments.hint', { max: MAX_SUPPORT_IMAGES })}</p>
      {error ? <p role="alert" className="m-0 text-caption text-badge-danger-fg">{error}</p> : null}
      {images.length > 0 ? (
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
          {images.map((image, index) => (
            <li key={`${index}-${image.slice(0, 32)}`} className="relative size-16 overflow-hidden rounded-md border border-border bg-n-50">
              <img src={image} alt={t('support.attachments.preview', { index: index + 1 })} className="size-full object-cover" />
              <Button
                type="button"
                variant="secondary"
                size="icon"
                aria-label={t('support.attachments.remove', { index: index + 1 })}
                disabled={disabled}
                onClick={() => onChange(images.filter((_, imageIndex) => imageIndex !== index))}
                className="absolute right-0.5 top-0.5 size-6 rounded-full bg-bg/90 p-1"
              >
                <X className="size-3.5" strokeWidth={1.75} aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export function SupportImages({ images }: { images: readonly string[] | undefined }) {
  const t = useT()
  if (!images || images.length === 0) return null
  return (
    <ul className="m-0 mt-2 flex list-none flex-wrap gap-2 p-0">
      {images.map((image, index) => (
        <li key={`${index}-${image.slice(0, 32)}`}>
          <img src={image} alt={t('support.attachments.preview', { index: index + 1 })} className="max-h-64 max-w-full rounded-md border border-border object-contain" />
        </li>
      ))}
    </ul>
  )
}
