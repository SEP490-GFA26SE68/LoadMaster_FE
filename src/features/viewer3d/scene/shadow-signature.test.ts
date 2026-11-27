import { describe, expect, test } from 'vitest'
import {
  BoxGeometry, Color, DirectionalLight, Group, InstancedMesh, Matrix4, Mesh, MeshLambertMaterial, MeshStandardMaterial, Scene,
} from 'three'
import { createShadowTracker } from './shadow-signature'

/** Cảnh nhỏ giống Planner: đèn đổ bóng, kiện (InstancedMesh đổ bóng), thân xe (mesh đổ bóng), vật không đổ bóng. */
function makeScene() {
  const scene = new Scene()
  const light = new DirectionalLight()
  light.position.set(3, 12, 4)
  light.castShadow = true
  const geometry = new BoxGeometry(1, 1, 1)
  const cargo = new InstancedMesh(geometry, new MeshLambertMaterial(), 3)
  cargo.castShadow = true
  for (let i = 0; i < 3; i++) cargo.setMatrixAt(i, new Matrix4().makeTranslation(i, 0, 0))
  const truck = new Group()
  const cab = new Mesh(new BoxGeometry(2, 2, 2), new MeshStandardMaterial())
  cab.castShadow = true
  truck.add(cab)
  const strip = new Mesh(new BoxGeometry(1, 0.01, 1), new MeshLambertMaterial())
  scene.add(light, cargo, truck, strip)
  const tracker = createShadowTracker()
  /** Như renderer: cập nhật ma trận thế giới rồi mới hỏi. */
  const changed = () => { scene.updateMatrixWorld(); return tracker.changed(scene) }
  return { scene, light, cargo, truck, cab, strip, changed }
}

describe('shadow signature', () => {
  test('the first frame draws the shadow map, an unchanged frame does not', () => {
    const { changed } = makeScene()
    expect(changed()).toBe(true)
    expect(changed()).toBe(false)
    expect(changed()).toBe(false)
  })

  test('moving the camera or a non-casting object never redraws the shadow map', () => {
    const { strip, changed } = makeScene()
    changed()
    strip.position.set(5, 0, 0)
    strip.visible = false
    expect(changed()).toBe(false)
  })

  test('a cargo matrix write (step, drag, fall, unload) redraws it; a colour write does not', () => {
    const { cargo, changed } = makeScene()
    changed()
    cargo.setColorAt(1, new Color('red'))
    cargo.instanceColor!.needsUpdate = true
    expect(changed(), 'instance colour only').toBe(false)
    cargo.setMatrixAt(1, new Matrix4().makeTranslation(1, 2, 0))
    cargo.instanceMatrix.needsUpdate = true
    expect(changed()).toBe(true)
    expect(changed()).toBe(false)
    cargo.count = 2
    expect(changed(), 'instance count').toBe(true)
  })

  test('moving a parent (vehicle resize, truck rolling away) redraws it through the world matrices', () => {
    const { truck, changed } = makeScene()
    changed()
    truck.position.x = 1.3
    expect(changed()).toBe(true)
    truck.scale.set(1, 1.1, 1)
    expect(changed()).toBe(true)
    expect(changed()).toBe(false)
  })

  test('visibility, the set of casters, geometry and material changes all redraw it', () => {
    const { scene, truck, cab, cargo, changed } = makeScene()
    changed()
    truck.visible = false
    expect(changed(), 'hidden parent').toBe(true)
    cab.position.y = 4
    expect(changed(), 'moving a child of a hidden parent').toBe(false)
    truck.visible = true
    expect(changed()).toBe(true)
    cab.castShadow = false
    expect(changed(), 'castShadow turned off').toBe(true)
    cab.castShadow = true
    changed()
    const extra = new Mesh(new BoxGeometry(), new MeshLambertMaterial())
    extra.castShadow = true
    scene.add(extra)
    expect(changed(), 'caster added').toBe(true)
    scene.remove(extra)
    expect(changed(), 'caster removed').toBe(true)
    cab.geometry = new BoxGeometry(3, 2, 2)
    expect(changed(), 'geometry replaced').toBe(true)
    cargo.material = new MeshLambertMaterial()
    expect(changed(), 'material replaced').toBe(true)
    cab.geometry.attributes.position!.needsUpdate = true
    expect(changed(), 'vertex data rewritten').toBe(true)
    expect(changed()).toBe(false)
  })

  test('moving the light or resizing its shadow camera redraws it', () => {
    const { light, changed } = makeScene()
    changed()
    light.position.set(4, 12, 4)
    expect(changed()).toBe(true)
    light.shadow.camera.left = -9
    expect(changed()).toBe(true)
    light.shadow.mapSize.set(1024, 1024)
    expect(changed()).toBe(true)
    expect(changed()).toBe(false)
  })
})
