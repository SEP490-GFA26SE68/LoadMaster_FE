import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { LanguageMenu } from '@/components/LanguageMenu'
import { Card, CardBody, CardHeader, CardMeta, CardTitle } from '@/components/ui/Card'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { BrandMark } from '../BrandMark'

/**
 * Khung chung của hai trang tài liệu bàn giao V2.3 (`Main.jpg`, `ThanhPhan.jpg`): **dải trời** có logo và chọn ngôn ngữ, đường dẫn
 * "Hệ thống / /route", tiêu đề Archivo 32px chữ trắng, một đoạn mô tả; rồi lưới thẻ đè lên đáy dải `--sky-overlap` (44px) như
 * `PageHero overlap`. Hai trang mở công khai, không đăng nhập nên không có mục điều hướng — chỉ logo về trang chính.
 */
export function SheetLayout({
  path,
  title,
  lede,
  aside,
  children,
}: {
  /** Route của trang, hiện trong đường dẫn: `/kieu-dang`. */
  path: string
  title: string
  lede: string
  /** Khối bên phải tiêu đề, trên dải trời (hai thẻ "có kính / không kính" ở `/kieu-dang`). */
  aside?: ReactNode
  children: ReactNode
}) {
  const t = useT()
  return (
    <div className="min-h-dvh bg-app">
      <header className="sky pb-[calc(var(--sky-overlap)+24px)]">
        <div className="mx-auto max-w-shell px-7 max-sm:px-4">
          <div className="flex h-15 items-center gap-4">
            <Link
              to="/"
              aria-label={t('nav.home')}
              className="flex items-center gap-2.5 rounded-md outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
            >
              <BrandMark />
              <span aria-hidden className="font-display text-[18px] leading-none font-bold tracking-[-0.2px] text-sky-text font-stretch-112%">
                Load<span className="text-cyan-300">Master</span>
              </span>
            </Link>
            <div className="ml-auto">
              <LanguageMenu />
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-x-10 gap-y-6 pt-3">
            <div className="flex min-w-[min(100%,520px)] flex-1 flex-col gap-2">
              <nav aria-label={t('designSystem.frame.breadcrumb')}>
                <ol className="m-0 flex list-none items-center gap-1.5 p-0 text-fine text-sky-text-3">
                  <li>{t('designSystem.frame.system')}</li>
                  <li aria-hidden>/</li>
                  <li aria-current="page" className="font-mono">{path}</li>
                </ol>
              </nav>
              <h1 className="font-display text-display leading-[1.1] font-bold tracking-[-0.5px] text-sky-text font-stretch-112%">{title}</h1>
              <p className={cn('max-w-160 text-pretty text-sky-text-3', aside ? 'text-body-lg leading-6.5' : 'text-body')}>{lede}</p>
            </div>
            {aside ? <div className="w-full lg:w-[min(46%,690px)]">{aside}</div> : null}
          </div>
        </div>
      </header>

      <main className="sky-overlap mx-auto max-w-shell px-7 pb-10 max-sm:px-4">{children}</main>
    </div>
  )
}

/** Thẻ của lưới tài liệu: đầu thẻ Archivo 16px + ghi chú, thân tuỳ chọn padding (`bare` cho bảng, khung tràn mép). */
export function SheetCard({
  title,
  meta,
  bare = false,
  className,
  bodyClassName,
  children,
}: {
  title: string
  meta?: string
  bare?: boolean
  className?: string
  bodyClassName?: string
  children: ReactNode
}) {
  return (
    <Card className={cn('flex min-w-0 flex-col', className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {meta ? <CardMeta>{meta}</CardMeta> : null}
      </CardHeader>
      {bare ? children : <CardBody className={cn('flex flex-col gap-3.5', bodyClassName)}>{children}</CardBody>}
    </Card>
  )
}

/**
 * Khối nền trời thu nhỏ trong thẻ — cho thành phần chỉ dùng trên dải trời hoặc khung 3D (nút kính, tab trên dải, ô số liệu kính).
 * Ảnh `--sky` co theo khối, không gắn vào khung nhìn như `.sky` của đầu trang.
 */
export function SkyStage({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('rounded-lg bg-sky-end bg-(image:--sky) p-4 text-sky-text', className)}>{children}</div>
}

/**
 * Bản xem trước không bấm được: nút, hộp thoại, toast, menu vẽ bằng đúng lớp của thành phần thật nhưng `inert` — không nhận bàn
 * phím, chuột hay trình đọc màn hình, nên không thành "nút giả" (AGENTS mục 6). Tên nhóm đọc được nằm ở vỏ ngoài.
 */
export function Preview({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  const t = useT()
  return (
    <div role="group" aria-label={t('designSystem.components.preview', { name: label })} className={className}>
      <div inert className="contents">{children}</div>
    </div>
  )
}
