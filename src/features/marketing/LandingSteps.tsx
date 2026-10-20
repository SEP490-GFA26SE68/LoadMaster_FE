import { useRef, useState, type AnimationEvent, type CSSProperties, type ReactNode } from 'react'
import { Lumo, LUMO_NAME } from '@/components/brand/Lumo'
import { ROLE_ICON } from '@/components/RoleBadge'
import { useFormat, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { Role } from '@/types/user'
import { Reveal, RevealWords, useRevealMotion, words } from './reveal'
import { wordStagger } from './reveal/split-text'
import { SectionHeading } from './SectionHeading'
import { StepRail, StepsStage, stepState, type StepState } from './StepsStage'
import { useActiveStep, useStepsStage } from './useActiveStep'

/** Bốn bước của một chuyến hàng, mỗi bước kèm vai trò làm việc đó (ma trận quyền của ứng dụng). */
const STEPS = [
  { key: 'intake', roles: ['dispatcher', 'manager'] },
  { key: 'plan', roles: ['dispatcher'] },
  { key: 'optimize', roles: ['dispatcher'] },
  { key: 'operate', roles: ['warehouse', 'driver', 'dispatcher'] },
] as const satisfies readonly { key: string; roles: readonly Role[] }[]

const TITLE = 'm-0 font-display text-h2 font-[650] tracking-[-0.2px] text-ink-strong font-stretch-108%'
/** Lời của Lumo cho một bước: khung chú thích nhìn thấy được, trừ khi khung dính đang nói thay (từ 1.024 px). */
const NOTE = 'm-0 rounded-md border-l-2 border-cyan-300 bg-tint-blue p-3 text-body text-ink-2 pointer-coarse:text-body-lg'

/** Tiêu đề bước: "Bước n:" ẩn rồi tên bước. Chuyển động bật: tên bước nhô lên từng từ như `RevealWords`, cổng là mục của danh sách. */
function StepTitle({ prefix, title }: { prefix: string; title: string }) {
  const motion = useRevealMotion()
  const [settled, setSettled] = useState(false)
  const parts = words(title)
  const count = parts.filter((part) => part.word).length
  const pieces: ReactNode[] = []
  let index = 0
  for (const [key, part] of parts.entries()) {
    if (part.word) {
      const last = index === count - 1 ? '' : undefined
      pieces.push(<span key={key} className="reveal-word reveal-piece" style={{ '--w': index } as CSSProperties} data-last={last}>{part.word}</span>)
      index += 1
    }
    if (part.space) pieces.push(part.space)
  }
  const handleEnd = (event: AnimationEvent<HTMLHeadingElement>) => {
    if (event.target instanceof Element && event.target.hasAttribute('data-last')) setSettled(true)
  }
  const step = { '--word-step': `min(var(--stagger-word), ${wordStagger(count).toFixed(2)}ms)` } as CSSProperties
  return (
    <h3 className={TITLE} style={motion ? step : undefined} data-done={settled ? '' : undefined} onAnimationEnd={motion ? handleEnd : undefined}>
      <span className="sr-only">{prefix}: </span>
      {motion ? <><span className="sr-only select-none">{title}</span><span aria-hidden="true" data-words="rise" key={title}>{pieces}</span></> : title}
    </h3>
  )
}

/**
 * Một bước: số 01–04 mở ngang, tên bước nhô lên từng từ, câu mô tả đậm dần, lời của Lumo hiện dần, chip vai trò bật ra cách nhau 70 ms.
 * Có khung dính: cột đường ray bên trái, mục cao ít nhất 56 % khung nhìn, lời của Lumo chỉ còn cho trình đọc màn hình (khung dính nói thay).
 */
function StepItem({ step, index, stage, state }: { step: (typeof STEPS)[number]; index: number; stage: boolean; state: StepState }) {
  const t = useT()
  const format = useFormat()
  const { key, roles } = step
  const body = (
    <>
      <div aria-hidden className="flex items-center gap-4">
        <Reveal as="span" kind="wipe" className="font-display text-figure font-bold text-primary tabular-nums font-stretch-112%">
          {String(index + 1).padStart(2, '0')}
        </Reveal>
        {stage ? null : <span className="h-px flex-1 bg-border group-last:hidden" />}
        {stage ? null : <span className="size-2 flex-none rounded-full bg-cyan-400 group-last:hidden" />}
      </div>
      <StepTitle prefix={t('landing.how.step', { number: index + 1 })} title={t(`landing.how.steps.${key}.title`)} />
      <RevealWords as="p" text={t(`landing.how.steps.${key}.text`)} mode="ink" delay={200} className="m-0 text-body-lg text-ink-2" />
      <Reveal as="p" kind="fade" delay={350} className={cn(NOTE, stage && 'lg:sr-only')}>
        <span className="sr-only">{t('landingStory.lumo.says', { name: LUMO_NAME })}</span> {t(`landingStory.lumo.how.${key}`)}
      </Reveal>
      <p className={cn('m-0 flex flex-wrap items-center gap-2 pt-1', !stage && 'mt-auto')}>
        <span className="text-small font-medium text-ink-3 pointer-coarse:text-body-lg">{t('landing.how.who')}</span>
        <span className="sr-only">: {format.list(roles.map((role) => t(`roles.${role}`)))}</span>
        {roles.map((role, order) => {
          const Icon = ROLE_ICON[role]
          return (
            <Reveal as="span" key={role} kind="pop" index={order} delay={300} aria-hidden
              className="inline-flex items-center gap-1.5 rounded-full bg-tint-slate px-2.5 py-1 text-small font-medium text-tint-slate-fg pointer-coarse:text-body-lg">
              <Icon className="size-3.5" strokeWidth={1.5} />
              {t(`roles.${role}`)}
            </Reveal>
          )
        })}
      </p>
    </>
  )
  return (
    <Reveal as="li" group index={index % 2} data-step={index} data-step-state={stage ? state : undefined}
      className={stage ? 'grid min-h-[56vh] grid-cols-[1rem_minmax(0,1fr)] gap-x-6' : 'group flex min-w-0 flex-col gap-4'}>
      {stage ? <><StepRail state={state} /><div className="flex min-w-0 flex-col gap-4 pb-16">{body}</div></> : body}
    </Reveal>
  )
}

/** Câu kết sau danh sách (mục 4 của khung dính): chuyến giao xong là có báo cáo. Có khung dính thì chỉ còn nút cuối của đường ray. */
function ClosingNote({ stage, state }: { stage: boolean; state: StepState }) {
  const t = useT()
  const says = t('landingStory.lumo.says', { name: LUMO_NAME })
  const line = t('landingStory.lumo.how.done')
  if (!stage) {
    return (
      <Reveal as="p" kind="fade" data-step={4} className={cn(NOTE, 'mt-10 max-w-180')}>
        <span className="sr-only">{says}</span> {line}
      </Reveal>
    )
  }
  return (
    <p data-step={4} data-step-state={state} className="m-0 grid min-h-[60vh] grid-cols-[1rem_minmax(0,1fr)] gap-x-6">
      <StepRail state={state} end />
      <span className="sr-only">{`${says} ${line}`}</span>
    </p>
  )
}

/**
 * "Cách hoạt động" (`#cach-hoat-dong`): đúng bốn mục, tiêu đề mang "Bước n" ẩn, vai trò là chip trong một đoạn văn (trình đọc màn hình nghe
 * tên vai trò ngăn bằng dấu phẩy), lời của Lumo trong từng mục, câu kết sau danh sách. Từ 1.024 px (có IntersectionObserver): danh sách nối
 * bằng đường ray dọc tô tới mục đang đọc (`useActiveStep`) cạnh khung dính `StepsStage`; mục cắt `overflow-x: clip` (`hidden` làm hỏng
 * `sticky`). Hẹp hơn: Lumo mang kiện đứng trên danh sách.
 */
export function LandingSteps() {
  const t = useT()
  const stage = useStepsStage()
  const track = useRef<HTMLDivElement>(null)
  const active = useActiveStep(track, stage)
  return (
    <section id="cach-hoat-dong" aria-labelledby="landing-how" className="scroll-mt-24 overflow-x-clip border-y border-border bg-bg px-4 py-16 md:px-shell lg:py-24">
      <SectionHeading id="landing-how" title={t('landing.how.title')} lede={t('landing.how.lede')} />
      {stage ? null : (
        <Reveal className="mt-10 flex"><Lumo pose="carry" px={112} loading="lazy" /></Reveal>
      )}
      <div className={stage ? 'mt-14 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:gap-x-12 xl:gap-x-20' : 'mt-6'}>
        <div ref={track} className="min-w-0">
          <ol className={cn('m-0 grid list-none p-0', !stage && 'gap-x-8 gap-y-12 md:grid-cols-2 xl:grid-cols-4')}>
            {STEPS.map((step, index) => (
              <StepItem key={step.key} step={step} index={index} stage={stage} state={stepState(index, active)} />
            ))}
          </ol>
          <ClosingNote stage={stage} state={stepState(STEPS.length, active)} />
        </div>
        {stage ? <StepsStage active={active} /> : null}
      </div>
    </section>
  )
}
