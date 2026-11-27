import { events as createPointerEvents, type EventManager, type RootStore } from '@react-three/fiber'

type FrameScheduler = { request: (callback: () => void) => number; cancel: (handle: number) => void }

const BROWSER_FRAMES: FrameScheduler = {
  request: (callback) => requestAnimationFrame(callback),
  cancel: (handle) => cancelAnimationFrame(handle),
}

/**
 * Cổng của `pointermove` trước khi R3F dò vật dưới con trỏ (thuần, nhận bộ hẹn khung để test được). `pointermove` chỉ dùng cho rê
 * chuột (hover kiện, vật cản, tay kéo của editor); R3F dò **mọi** vật có handler rê — với 1.000 kiện là hai InstancedMesh 1.000
 * instance — trước khi handler kịp bỏ qua, nên:
 * - đang giữ nút (kéo xoay camera, kéo bằng ngón tay) thì không dò: không ai hover lúc đó. Kéo kiện của editor dùng sự kiện gốc và
 *   tắt hẳn sự kiện R3F, không đi qua đây;
 * - dò tối đa một lần mỗi khung: lần đầu trong khung dò ngay, các lần sau trong cùng khung chỉ giữ lần mới nhất và dò nó ở khung kế.
 * `drop` bỏ lần đang chờ (nhấn nút, con trỏ rời khung, huỷ) để lần rê cũ không bật lại hover sau đó.
 */
export function createHoverGate(move: (event: Event) => void, frames: FrameScheduler = BROWSER_FRAMES) {
  let handle = 0
  let pending: Event | null = null
  const release = () => {
    handle = 0
    const event = pending
    pending = null
    if (event) handle = probe(event)
  }
  const probe = (event: Event) => {
    const next = frames.request(release)
    move(event)
    return next
  }
  return {
    move(event: Event) {
      if ((event as PointerEvent).buttons) { pending = null; return }
      if (handle) pending = event
      else handle = probe(event)
    },
    drop() { pending = null },
    dispose() {
      pending = null
      if (handle) frames.cancel(handle)
      handle = 0
    },
  }
}

/** Lớp sự kiện của `SceneCanvas`: đúng lớp mặc định của R3F, chỉ `pointermove` đi qua `createHoverGate`. */
export function createViewerPointerEvents(store: RootStore): EventManager<HTMLElement> {
  const manager = createPointerEvents(store)
  const handlers = manager.handlers!
  const gate = createHoverGate(handlers.onPointerMove)
  const dropThen = (handler: EventListener): EventListener => (event) => { gate.drop(); handler(event) }
  return {
    ...manager,
    handlers: {
      ...handlers,
      onPointerMove: gate.move,
      onPointerDown: dropThen(handlers.onPointerDown),
      onPointerLeave: dropThen(handlers.onPointerLeave),
      onPointerCancel: dropThen(handlers.onPointerCancel),
    },
    disconnect: () => { gate.dispose(); manager.disconnect?.() },
  }
}
