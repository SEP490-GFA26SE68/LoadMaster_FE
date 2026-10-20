import { Check } from 'lucide-react'
import { useEffect, useState, type AnimationEvent } from 'react'
import { LUMO_POSES, type LumoPose } from '@/components/brand/Lumo'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { LumoSays, Reveal, useRevealMotion } from './reveal'
import { STEP_SCENES, type StepSceneKey } from './steps/StepScenes'

/** Tư thế của Lumo theo mục đang đọc: bốn bước rồi câu kết (4, chuyến đã giao xong); lời là `landingStory.lumo.how.<key>`. */
const POSES = { intake: 'carry', plan: 'point', optimize: 'tablet', operate: 'scan', done: 'done' } as const satisfies Record<StepSceneKey, LumoPose>
const LAST_STEP = 3
const STEP_COUNT = LAST_STEP + 1

export type StepState = 'done' | 'active' | 'todo'

/** Trạng thái một mục của đường ray so với mục đang đọc. */
export function stepState(index: number, active: number): StepState {
  return index < active ? 'done' : index === active ? 'active' : 'todo'
}

const NODE: Record<StepState, string> = {
  done: 'border-primary bg-primary',
  active: 'border-primary bg-bg ring-4 ring-primary-bg',
  todo: 'border-line-strong bg-bg',
}
/** Bốn đoạn tiến độ dưới tên bước: đã qua cyan nhạt, đang đọc `--primary`, chưa tới gần như trắng. */
const SEGMENT: Record<StepState, string> = {
  done: 'bg-cyan-300',
  active: 'bg-primary',
  todo: 'bg-cyan-100',
}

/**
 * Cột đường ray của một mục khi có khung dính: nút ngang giữa hàng số (cùng cỡ chữ `figure` nên `0.525em` là giữa hàng) và đoạn nối
 * xuống nút của mục sau — mục liền nhau không khoảng hở nên đoạn dài đúng bằng mục. Đoạn tô cyan khi mục đã qua (`lp-rail-fill`,
 * theo `data-step-state` của mục). `end`: nút cuối có dấu kiểm, không đoạn nối.
 */
export function StepRail({ state, end = false }: { state: StepState; end?: boolean }) {
  const at = 'absolute top-[0.525em] left-1/2'
  return (
    <span aria-hidden className="relative font-display text-figure">
      {end ? (
        <span className={cn(at, 'lp-rail-node grid size-8 -translate-1/2 place-items-center rounded-full border-2', state === 'todo' ? NODE.todo : 'border-primary bg-primary text-bg')}>
          <Check className="size-4" strokeWidth={1.5} />
        </span>
      ) : (
        <>
          <span className={cn(at, 'h-full w-0.5 -translate-x-1/2 bg-border')}>
            <span className="lp-rail-fill absolute inset-0 bg-primary" />
          </span>
          <span className={cn(at, 'lp-rail-node size-4 -translate-1/2 rounded-full border-2', NODE[state])} />
        </>
      )}
    </span>
  )
}

function preload(pose: LumoPose): void {
  const image = new Image()
  image.decoding = 'async'
  image.src = LUMO_POSES[pose]
}

/** Số lớn của một mục: 01–04; câu kết vẫn là 04. */
function numeralOf(index: number): string {
  return String(Math.min(index, LAST_STEP) + 1).padStart(2, '0')
}

/** Một lần hiện của khung: mục và số lần đổi mục tới lúc đó — khoá mới mỗi lần đổi nên cảnh quay lại vẫn chạy lại từ đầu. */
type Shot = { index: number; gen: number }

/** Bốn đoạn tiến độ của chuyến; câu kết: cả bốn đã qua. */
function StageProgress({ index }: { index: number }) {
  return (
    <span className="mt-2 flex gap-1.5">
      {Array.from({ length: STEP_COUNT }, (_, step) => {
        const state = stepState(step, index)
        return <span key={step} data-state={state} className={cn('lp-stage-step h-1 flex-1 rounded-full', SEGMENT[state])} />
      })}
    </span>
  )
}

/**
 * Khung dính của Cách hoạt động (từ 1.024 px, `aria-hidden` — chữ của từng bước vẫn nằm trong mục của danh sách): số lớn, tên bước và bốn
 * đoạn tiến độ của mục đang đọc; giữa khung là cảnh của bước đó (`StepScenes`: nhập kiện → tuyến → ba phương án → dỡ ở cửa sau → chuyến đã
 * giao xong); dưới cùng Lumo đổi tư thế (mang kiện → chỉ → máy tính bảng → quét → xong) và gõ lời của bước. Đổi mục: số, tên và cảnh cũ mờ
 * đi trong khi cái mới hiện lên chồng đúng chỗ (220 ms), các mảnh của cảnh mới hiện dần một lần; số không đổi (bước 4 → câu kết) thì đứng
 * yên. Ảnh của hai tư thế kế tiếp tải trước. Chuyển động tắt: mọi thứ đổi ngay, cảnh tĩnh ở trạng thái cuối.
 */
export function StepsStage({ active }: { active: number }) {
  const t = useT()
  const motion = useRevealMotion()
  const index = Math.min(Math.max(active, 0), STEP_SCENES.length - 1)
  const [view, setView] = useState<{ current: Shot; previous: Shot | null }>({ current: { index, gen: 0 }, previous: null })
  if (view.current.index !== index) setView({ current: { index, gen: view.current.gen + 1 }, previous: motion ? view.current : null })
  const { current, previous } = view
  const { key } = STEP_SCENES[current.index] ?? STEP_SCENES[0]

  useEffect(() => {
    for (const scene of STEP_SCENES.slice(current.index + 1, current.index + 3)) preload(POSES[scene.key])
  }, [current.index])

  const handleLeft = (event: AnimationEvent<HTMLElement>) => {
    if (event.target === event.currentTarget) setView((now) => (now.previous ? { ...now, previous: null } : now))
  }
  const titleOf = (shot: Shot) => {
    const scene = STEP_SCENES[shot.index]?.key ?? 'intake'
    return scene === 'done' ? t('landing.how.done') : t(`landing.how.steps.${scene}.title`)
  }
  const shots = previous ? [{ ...previous, leaving: true }, { ...current, leaving: false }] : [{ ...current, leaving: false }]
  const numerals = previous && numeralOf(previous.index) === numeralOf(current.index) ? shots.slice(1) : shots
  /** Lớp của một lớp chồng: cái cũ mờ đi, cái mới hiện lên — chỉ khi đang có cái cũ. */
  const swap = (leaving: boolean, alone = false) => (leaving ? 'lp-swap-out' : previous && !alone ? 'lp-swap-in' : undefined)
  const layer = (shot: Shot & { leaving: boolean }, alone = false) => ({
    'data-leaving': shot.leaving ? '' : undefined,
    className: cn('[grid-area:1/1]', swap(shot.leaving, alone)),
    onAnimationEnd: shot.leaving ? handleLeft : undefined,
  })

  return (
    <Reveal kind="fade" aria-hidden className="lp-steps-stage sticky flex flex-col self-start rounded-xl border border-border bg-surface p-7 xl:p-9">
      <div className="grid font-display text-figure font-bold text-primary tabular-nums font-stretch-112%">
        {numerals.map((shot) => (
          <span key={`numeral-${shot.gen}`} {...layer(shot, numerals.length === 1)}>{numeralOf(shot.index)}</span>
        ))}
      </div>
      <p className="m-0 mt-1 grid font-display text-h2 font-[650] tracking-[-0.2px] text-balance text-ink-strong font-stretch-108%">
        {shots.map((shot) => (
          <span key={`title-${shot.gen}`} {...layer(shot)}>{titleOf(shot)}</span>
        ))}
      </p>
      <StageProgress index={current.index} />
      <div className="lp-stage-scenes relative my-4 min-h-0 flex-1">
        {shots.map((shot) => {
          const { key: scene, Scene } = STEP_SCENES[shot.index] ?? STEP_SCENES[0]
          const { className, ...rest } = layer(shot)
          return (
            <div key={`scene-${shot.gen}`} data-scene={scene} {...rest} className={cn('lp-stage-scene absolute inset-0', className)}>
              <Scene motion={motion} />
            </div>
          )
        })}
      </div>
      <LumoSays
        pose={POSES[key]}
        px={{ base: 144, wide: 176 }}
        side="bubble-right"
        loading="eager"
        text={t(`landingStory.lumo.how.${key}`)}
        className="flex-none [@media(max-height:719px)]:[--lumo-px:112px]"
      />
    </Reveal>
  )
}
