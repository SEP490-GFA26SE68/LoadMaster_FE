import { Line } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type ComponentRef } from 'react'
import { BoxGeometry, EdgesGeometry, Object3D, type Group, type InstancedMesh, type Mesh, type MeshBasicMaterial } from 'three'
import { readToken } from '@/lib/tokens'
import { useFormat, useT } from '@/lib/i18n'
import type { ScenePlacement, PositionCm } from '@/features/viewer3d/scene-input'
import type { LoadPlanViewerState } from '../useLoadPlanViewer'
import { boxCenter, boxSize, obstacleCenter, obstacleSize, SCENE_SCALE, type Vec3 } from '../scene/units'
import { SceneCallout } from '../scene/SceneCallout'
import { SceneTag } from '../scene/SceneTag'
import { useObstacleText } from '../overlays/useObstacleText'
import type { ManualEditor } from './useManualEditor'
import { editorMeasurements, overlapRegions, snapFeedbackBoxes, type FeedbackBox } from './spatial-feedback'

const point = (p: PositionCm): Vec3 => [p.x * SCENE_SCALE, p.z * SCENE_SCALE, p.y * SCENE_SCALE]
const EMPTY: Vec3[] = [[0, 0, 0], [0, 0, 0]]
/** Only selected guides. Preview refs update geometry/DOM imperatively, with no React drag subscription. */
export function EditorSpatialFeedback({ placement, state, editor }: {
  placement: ScenePlacement; state: LoadPlanViewerState; editor: ManualEditor
}) {
  const lines = useRef<ComponentRef<typeof Line>>(null)
  const original = useRef<Group>(null), plane = useRef<Mesh>(null)
  const snap = useRef<InstancedMesh>(null), conflict = useRef<InstancedMesh>(null)
  const snapMaterial = useRef<MeshBasicMaterial>(null)
  const labels = useRef<Array<Group | null>>([]), texts = useRef<Array<HTMLSpanElement | null>>([])
  const obstacleAnchor = useRef<Group>(null), obstacleTitle = useRef<HTMLSpanElement>(null), obstacleNote = useRef<HTMLSpanElement>(null)
  const obstacleText = useObstacleText()
  const previous = useRef<unknown>(undefined)
  const invalidate = useThree((s) => s.invalidate)
  const format = useFormat()
  const t = useT()
  const showMeasurements = useThree((s) => s.size.width >= 600)
  const source = state.sceneModel.placementById.get(placement.id)!
  const edges = useMemo(() => { const box = new BoxGeometry(); const e = new EdgesGeometry(box); box.dispose(); return e }, [])
  const dummy = useMemo(() => new Object3D(), [])
  useEffect(() => () => edges.dispose(), [edges])
  useEffect(() => { previous.current = undefined; invalidate() }, [placement, editor.plane, showMeasurements, invalidate, t])

  useFrame(() => {
    const preview = editor.preview.getLatest()
    const active = preview?.id === placement.id && preview.dragging ? preview : null
    const key = active ?? placement
    if (previous.current === key) return
    previous.current = key
    const p = active ? { ...placement, position: active.position } : placement
    const result = active?.result ?? editor.inspect(p)
    const guides = editorMeasurements(p, state.placements, state.sceneModel.vehicle)
    const points = guides.flatMap((g) => [...point(g.from), ...point(g.to)])
    const changed = p.position.x !== source.position.x || p.position.y !== source.position.y || p.position.z !== source.position.z || p.orientation !== source.orientation
    if (original.current) original.current.visible = changed
    if (changed) points.push(...boxCenter(source), ...boxCenter(p))
    lines.current?.geometry.setPositions(points)
    guides.forEach((g, i) => {
      labels.current[i]?.position.set(...point({ x: (g.from.x + g.to.x) / 2, y: (g.from.y + g.to.y) / 2, z: (g.from.z + g.to.z) / 2 }))
      if (texts.current[i]) texts.current[i]!.textContent = `${t(`viewer.editor.guides.${g.label}`)} ${format.length(g.cm)}`
    })
    // Vật cản đầu tiên kiện đang chồng lên / tựa lên: một nhãn neo đỏ trên đỉnh vật cản (V2.3 Planner3DKhongTheDat), không thêm mesh.
    const obstacle = state.sceneModel.vehicle.obstacles.find((o) => result.obstacleIds.includes(o.id))
    if (obstacleAnchor.current) {
      obstacleAnchor.current.visible = Boolean(obstacle)
      if (obstacle) {
        const [ox, oy, oz] = obstacleCenter(obstacle)
        obstacleAnchor.current.position.set(ox, oy + obstacleSize(obstacle)[1] / 2, oz)
        if (obstacleTitle.current) obstacleTitle.current.textContent = t('viewer.editor.obstacleTag', { id: obstacle.id })
        if (obstacleNote.current) obstacleNote.current.textContent = `${obstacleText.type(obstacle)} · ${obstacleText.bearing(obstacle)}`
      }
    }
    const color = readToken(!result.valid ? '--danger' : result.advisories.length ? '--warning' : '--success')
    snapMaterial.current?.color.set(color)
    function write(mesh: InstancedMesh | null, boxes: FeedbackBox[]) {
      if (!mesh) return
      for (let i = 0; i < mesh.count; i++) {
        const box = boxes[i]
        if (box) {
          dummy.position.set((box.position.x + box.lengthCm / 2) * SCENE_SCALE, (box.position.z + box.heightCm / 2) * SCENE_SCALE, (box.position.y + box.widthCm / 2) * SCENE_SCALE)
          dummy.scale.set(box.lengthCm * SCENE_SCALE, box.heightCm * SCENE_SCALE, box.widthCm * SCENE_SCALE)
        } else dummy.scale.set(0, 0, 0)
        dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix)
      }
      mesh.instanceMatrix.needsUpdate = true
    }
    write(snap.current, snapFeedbackBoxes(p, active?.targets ?? [], state.placements))
    write(conflict.current, overlapRegions(p, state.placements, result.overlapIds))
    if (plane.current) {
      plane.current.position.set(...boxCenter(p))
      const size = boxSize(p).map((s) => s + 0.2) as Vec3
      size[editor.plane === 'xy' ? 1 : editor.plane === 'xz' ? 2 : 0] = 0.003
      plane.current.scale.set(...size)
    }
  }, -1)
  return <group name="editor-spatial-feedback">
    <Line ref={lines} points={EMPTY} segments color={readToken('--bg')} lineWidth={1.5} raycast={() => null} />
    <group ref={original} name="original-placement" visible={false}>
      <lineSegments geometry={edges} position={boxCenter(source)} scale={boxSize(source)} raycast={() => null}>
        <lineBasicMaterial color={readToken('--bg')} transparent opacity={0.3} />
      </lineSegments>
      {showMeasurements ? <SceneCallout position={boxCenter(source)} offset={[-140, 112]} width={160}><SceneTag dashed title={t('viewer.editor.originalPosition')} /></SceneCallout> : null}
    </group>
    <mesh ref={plane} name="movement-plane" raycast={() => null}>
      <boxGeometry /><meshBasicMaterial color={readToken('--info')} transparent opacity={0.1} depthWrite={false} />
    </mesh>
    <instancedMesh ref={snap} name="snap-surfaces" args={[undefined, undefined, 3]} frustumCulled={false} raycast={() => null}>
      <boxGeometry /><meshBasicMaterial ref={snapMaterial} transparent opacity={0.48} depthWrite={false} />
    </instancedMesh>
    <instancedMesh ref={conflict} name="overlap-regions" args={[undefined, undefined, 4]} frustumCulled={false} raycast={() => null}>
      <boxGeometry /><meshBasicMaterial color={readToken('--danger')} transparent opacity={0.65} depthWrite={false} />
    </instancedMesh>
    {showMeasurements ? [0, 1, 2].map((i) => <group key={i} ref={(g) => { labels.current[i] = g }}>
      <SceneCallout offset={i === 0 ? [150, -32] : i === 1 ? [-170, -32] : [-160, 60]} width={180}>
        <SceneTag mono><span ref={(el) => { texts.current[i] = el }} /></SceneTag>
      </SceneCallout>
    </group>) : null}
    <group ref={obstacleAnchor} name="editor-obstacle-anchor" visible={false}>
      <SceneCallout offset={[90, 70]} width={220} anchor>
        <SceneTag tone="bad" title={<span ref={obstacleTitle} />} code={<span ref={obstacleNote} className="font-sans" />} />
      </SceneCallout>
    </group>
  </group>
}
