import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Color, InstancedBufferAttribute, Matrix4, PlaneGeometry, type InstancedMesh } from 'three'
import { readToken } from '@/lib/tokens'
import { PUFFS, puffAt, smokeActive } from './exhaust-smoke'
import type { StorySource } from './story-clock'

/**
 * Bảng quay mặt về camera: tâm theo ma trận của bụm, cạnh theo cỡ của bụm, dựng trong không gian nhìn. Mỗi bụm xoay một góc riêng (theo
 * thứ tự của nó) để các bụm không cùng một hình. Chú thích trong mã shader viết tiếng Anh: chuỗi GLSL là chuỗi của mã nguồn.
 */
const VERTEX = /* glsl */ `
attribute float puffAlpha;
varying vec2 vUv;
varying float vAlpha;
void main() {
  vUv = uv;
  vAlpha = puffAlpha;
  // Camera-facing billboard: centre from the puff matrix, edge from puff size; each puff turns by its own angle
  float turn = float(gl_InstanceID) * 2.39996;
  vec2 corner = mat2(cos(turn), sin(turn), -sin(turn), cos(turn)) * position.xy;
  vec4 centre = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  centre.xy += corner * length(instanceMatrix[0].xyz);
  gl_Position = projectionMatrix * centre;
}
`

/**
 * Ba thuỳ mềm chồng nhau thành một bụm khói, mép gợn nhẹ theo góc — không thành đĩa tròn trơn hay quầng sáng; lõi hơi tối hơn mép để
 * bụm có khối, không phẳng như vệt sáng.
 */
const FRAGMENT = /* glsl */ `
uniform vec3 smokeColor;
varying vec2 vUv;
varying float vAlpha;
float lobe(vec2 p, vec2 c, float r) { return 1.0 - smoothstep(0.0, r, length(p - c)); }
void main() {
  vec2 p = vUv - 0.5;
  // Three soft lobes make one puff; the edge wobbles slightly with angle so it is not a perfect disc
  float edge = 1.0 + 0.06 * sin(atan(p.y, p.x) * 5.0);
  float body = max(max(lobe(p * edge, vec2(-0.12, -0.06), 0.4), lobe(p * edge, vec2(0.13, -0.03), 0.36)), lobe(p * edge, vec2(0.01, 0.13), 0.34));
  float a = body * vAlpha;
  if (a < 0.004) discard;
  // Core slightly darker than the edge so the puff reads as a volume
  gl_FragColor = vec4(smokeColor * (0.8 + 0.2 * (1.0 - body)), a);
  #include <colorspace_fragment>
}
`

const matrix = new Matrix4()
const HIDDEN = new Matrix4().makeScale(0, 0, 0)
const NO_RAYCAST = () => null

/**
 * Khói ở ống xả lúc xe rời kho (khung 3D trang giới thiệu): một InstancedMesh các bảng mềm quay mặt về camera, một draw call và chỉ
 * vẽ khi còn bụm khói đang bay (`smokeActive`) — lúc cảnh nghỉ không vẽ gì. Vị trí, cỡ, độ đục là hàm thuần của thời gian chuyện
 * (`exhaust-smoke.ts`) đọc trong `useFrame`, không qua React. Nằm ngoài nhóm xe: khói ở lại chỗ nó sinh ra khi xe lăn bánh đi.
 */
export function ExhaustSmoke({ story }: { story: StorySource }) {
  const mesh = useRef<InstancedMesh>(null)
  const last = useRef(Number.NaN)
  const geometry = useMemo(() => {
    const plane = new PlaneGeometry(1, 1)
    plane.setAttribute('puffAlpha', new InstancedBufferAttribute(new Float32Array(PUFFS.length), 1))
    return plane
  }, [])
  const uniforms = useMemo(() => ({ smokeColor: { value: new Color(readToken('--n-200') || 'white') } }), [])
  useEffect(() => () => geometry.dispose(), [geometry])

  useFrame(() => {
    const smoke = mesh.current
    if (!smoke) return
    const time = story.time()
    if (time === last.current) return
    last.current = time
    smoke.visible = smokeActive(time)
    if (!smoke.visible) return
    const alpha = geometry.getAttribute('puffAlpha') as InstancedBufferAttribute
    PUFFS.forEach((puff, index) => {
      const frame = puffAt(puff, time)
      alpha.setX(index, frame?.alpha ?? 0)
      if (!frame) { smoke.setMatrixAt(index, HIDDEN); return }
      const [x, y, z] = frame.center, size = frame.size
      smoke.setMatrixAt(index, matrix.makeScale(size, size, size).setPosition(x, y, z))
    })
    alpha.needsUpdate = true
    smoke.instanceMatrix.needsUpdate = true
  })

  return <instancedMesh name="landing-exhaust-smoke" ref={mesh} args={[geometry, undefined, PUFFS.length]} visible={false}
    frustumCulled={false} raycast={NO_RAYCAST} renderOrder={2}>
    <shaderMaterial vertexShader={VERTEX} fragmentShader={FRAGMENT} uniforms={uniforms} transparent depthWrite={false} />
  </instancedMesh>
}
