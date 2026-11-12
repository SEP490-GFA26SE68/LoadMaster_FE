import { Spinner } from '@/components/ui/Spinner'

/** Lớp phủ chờ máy chủ trên thẻ của bước đăng ký đang làm — đọc được bằng trình đọc màn hình. */
export function RegistrationLoading({ title, description }: { title: string; description: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 rounded-[inherit] bg-bg/85 px-6 py-12 text-center backdrop-blur-xs animate-[lm-fade-in_180ms_ease-out]"
    >
      <div className="flex size-14 items-center justify-center rounded-full bg-primary-bg text-primary">
        <Spinner className="size-7 border-2 border-primary border-t-transparent" />
      </div>
      <div className="flex flex-col items-center gap-1.5">
        <p className="text-body font-semibold text-ink-strong">{title}</p>
        <p className="max-w-sm text-small text-ink-2">{description}</p>
      </div>
    </div>
  )
}
