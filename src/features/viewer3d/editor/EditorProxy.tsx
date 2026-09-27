import { Edges, type CameraControls } from '@react-three/drei'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useRef, type ComponentRef } from 'react'
import { Plane, Raycaster, Vector2, Vector3, type Group, type MeshStandardMaterial } from 'three'
import { useT } from '@/lib/i18n'
import { readToken } from '@/lib/tokens'
import type { ScenePlacement } from '@/features/viewer3d/scene-input'
import type { LoadPlanViewerState } from '../useLoadPlanViewer'
import { roundCm } from '@/domain/geometry'
import { boxCenter, boxSize, fromScene, toScene } from '../scene/units'
import { snapPosition } from './snapping'
import { PLANE_AXES, type ManualEditor } from './useManualEditor'
import type { GeometryResult } from './geometry'
import { EditorAxes } from './EditorGuides'
import { EditorSpatialFeedback } from './EditorSpatialFeedback'
import { SceneCallout } from '../scene/SceneCallout'
import { SceneTag, type SceneTagTone } from '../scene/SceneTag'

type LabelTone = Extract<SceneTagTone, 'selected' | 'warn' | 'bad'>
const LABEL_TONES: readonly LabelTone[] = ['selected', 'warn', 'bad']
/** Quyết định 3 của V2.3: chỉ lỗi cứng đỏ, chỉ ràng buộc thật hổ phách; dời hợp lệ vẫn là kiện đang chọn bình thường. */
const toneOf = (result: GeometryResult): LabelTone => !result.valid ? 'bad' : result.advisories.length ? 'warn' : 'selected'

/** Exactly one proxy. Native captured gestures bypass instance raycasts after picking. */
export function EditorProxy({ placement, state, editor }: {
  placement: ScenePlacement; state: LoadPlanViewerState; editor: ManualEditor
}) {
  const t = useT()
  const group = useRef<Group>(null)
  const material = useRef<MeshStandardMaterial>(null)
  const cancel = useRef<(() => void) | null>(null)
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const setEvents = useThree((s) => s.setEvents)
  const get = useThree((s) => s.get)
  const invalidate = useThree((s) => s.invalidate)
  const labels = useRef<Partial<Record<LabelTone, HTMLSpanElement | null>>>({})
  const colorFor = (result: GeometryResult) => {
    // Nhãn neo đổi theo tư thế ngay trong lúc kéo: chỉ bật/tắt DOM, không qua React (mục 7).
    const tone = toneOf(result)
    for (const key of LABEL_TONES) { const el = labels.current[key]; if (el) el.style.display = key === tone ? '' : 'none' }
    return readToken(tone === 'bad' ? '--danger' : tone === 'warn' ? '--warning' : '--success')
  }

  useLayoutEffect(() => {
    group.current?.position.set(...boxCenter(placement))
    material.current?.color.set(colorFor(editor.inspect(placement)))
    invalidate()
  })
  useEffect(() => () => { cancel.current?.() }, [])

  function handlePointerDown(event: ThreeEvent<PointerEvent>) {
    event.stopPropagation()
    if (placement.pinned || event.button !== 0 || cancel.current) return
    const object = group.current
    if (!object) return
    const canvas = gl.domElement
    const controls = get().controls as ComponentRef<typeof CameraControls> | null
    const pointerId = event.pointerId
    const normal = editor.plane === 'xy' ? new Vector3(0, 1, 0)
      : editor.plane === 'xz' ? new Vector3(0, 0, 1) : new Vector3(1, 0, 0)
    if (Math.abs(event.ray.direction.dot(normal)) < 0.08) {
      editor.preview.publish({ id: placement.id, position: placement.position, result: editor.inspect(placement), sources: [], dragging: false,
        message: t('viewer.editor.wrongView') }, true)
      return
    }
    // Plane passes through the picked surface to avoid a jump at gesture start.
    const plane = new Plane().setFromNormalAndCoplanarPoint(normal, event.point)
    const initialHit = event.point.clone()
    const raycaster = new Raycaster(), pointer = new Vector2(), hit = new Vector3()
    let candidate = placement
    let moved = false
    const previousEnabled = controls?.enabled
    const previousEventsEnabled = get().events.enabled
    if (controls) controls.enabled = false
    setEvents({ enabled: false })
    canvas.setPointerCapture(pointerId)
    canvas.style.setProperty('cursor', 'grabbing')
    editor.preview.publish({ id: placement.id, position: placement.position, result: editor.inspect(placement), sources: [], dragging: true }, true)

    function handleMove(e: PointerEvent) {
      if (e.pointerId !== pointerId) return
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      pointer.set((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1)
      raycaster.setFromCamera(pointer, camera)
      if (!raycaster.ray.intersectPlane(plane, hit)) return
      const requested = {
        x: roundCm(placement.position.x + fromScene(hit.x - initialHit.x)),
        y: roundCm(placement.position.y + fromScene(hit.z - initialHit.z)),
        z: roundCm(placement.position.z + fromScene(hit.y - initialHit.y)),
      }
      const snapped = editor.snapping ? snapPosition(placement, requested, state.placements, state.sceneModel.vehicle, PLANE_AXES[editor.plane])
        : { position: requested, sources: [], targets: [] }
      candidate = { ...placement, position: snapped.position }
      moved = true
      const result = editor.inspect(candidate)
      object!.position.set(...boxCenter(candidate))
      material.current?.color.set(colorFor(result))
      editor.preview.publish({ id: placement.id, position: candidate.position, result, sources: snapped.sources, targets: snapped.targets, dragging: true })
      invalidate()
    }
    function finish(commit: boolean) {
      cancel.current = null
      // A synthetic click follows pointerup even after a long drag. Do not let it
      // select an occluder under an invalid ghost when that ghost returns home.
      if (moved) {
        const releaseClick = () => canvas.removeEventListener('click', swallowClick, true)
        function swallowClick(e: MouseEvent) { e.stopImmediatePropagation(); releaseClick() }
        canvas.addEventListener('click', swallowClick, true)
        window.setTimeout(releaseClick, 400)
      }
      canvas.removeEventListener('pointermove', handleMove)
      canvas.removeEventListener('pointerup', handleUp)
      canvas.removeEventListener('pointercancel', handleCancel)
      canvas.removeEventListener('lostpointercapture', handleCancel)
      window.removeEventListener('blur', handleCancel)
      window.removeEventListener('keydown', handleKey)
      window.removeEventListener('pointerdown', handleSecondPointer, true)
      if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId)
      if (controls && previousEnabled !== undefined) controls.enabled = previousEnabled
      setEvents({ enabled: previousEventsEnabled })
      canvas.style.removeProperty('cursor')
      const accepted = commit && moved && editor.commitMove(placement.id, candidate.position)
      if (!accepted) {
        object!.position.set(...boxCenter(placement))
        material.current?.color.set(colorFor(editor.inspect(placement)))
      }
      if (!commit || !moved) editor.preview.publish(null, true)
      invalidate()
    }
    function handleUp(e: PointerEvent) { if (e.pointerId === pointerId) finish(true) }
    function handleCancel() { finish(false) }
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') { e.preventDefault(); finish(false) } }
    function handleSecondPointer(e: PointerEvent) { if (e.pointerId !== pointerId) finish(false) }
    cancel.current = handleCancel
    canvas.addEventListener('pointermove', handleMove)
    canvas.addEventListener('pointerup', handleUp)
    canvas.addEventListener('pointercancel', handleCancel)
    canvas.addEventListener('lostpointercapture', handleCancel)
    window.addEventListener('blur', handleCancel)
    window.addEventListener('keydown', handleKey)
    window.addEventListener('pointerdown', handleSecondPointer, true)
  }

  return (
    <>
    <EditorSpatialFeedback placement={placement} state={state} editor={editor} />
    <group ref={group} name="editor-proxy" position={boxCenter(placement)}>
      <EditorAxes />
      <mesh scale={boxSize(placement)} onPointerDown={handlePointerDown} onClick={(e) => e.stopPropagation()}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial ref={material} transparent opacity={0.85} roughness={0.8} />
        <Edges color={readToken('--bg')} raycast={() => null} />
      </mesh>
      <SceneCallout position={[0, toScene(placement.heightCm) / 2, 0]} offset={[-130, -96]} width={190} anchor>
        {LABEL_TONES.map((tone) => <span key={tone} ref={(el) => { labels.current[tone] = el }} className="inline-block" style={{ display: 'none' }}>
          <SceneTag tone={tone} code={placement.id}
            title={t(tone === 'bad' ? 'viewer.selectionLabel.cannotPlace' : 'viewer.selectionLabel.selected', { stop: placement.stop })} />
        </span>)}
      </SceneCallout>
    </group>
    </>
  )
}
