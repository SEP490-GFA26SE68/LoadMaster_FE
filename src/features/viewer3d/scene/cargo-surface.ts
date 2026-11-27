import { CanvasTexture, SRGBColorSpace, type MeshStandardMaterial } from 'three'

/**
 * Atlas bề mặt kiện, một dải 6 ô 128 px: ba ô nền trung tính (băng keo carton, nan pallet, nẹp thùng gỗ — hình hộp vẫn là bao của
 * domain, không phải mô hình vật lý của hàng bên trong) và ba ô **dấu theo dữ liệu thật** của kiện, vẽ bằng hình không chữ: ly vỡ kiểu
 * ISO 780 cho kiện dễ vỡ (`fragile`), hai mũi tên hướng lên cho kiện giữ chiều đứng, và một ô có cả hai. Ô của từng kiện là thuộc tính
 * instance `packageSurface` (`cargo-marks.ts`); không thêm vật liệu hay draw call.
 *
 * Dấu chỉ vẽ trên bốn mặt bên (mặt trên / đáy giữ ô nền), là một ô vuông giữa mặt kiện, cạnh = 55 % cạnh ngắn của mặt nhưng không quá
 * `MARK_MAX_M` — kiện to không có dấu khổng lồ, mặt nhỏ hơn `MARK_MIN_M` không có dấu. Ô vuông tính bằng mét từ kích thước của chính
 * instance nên không méo theo mặt kiện; trục dọc của ô luôn là trục cao của thế giới — hộp instance chỉ tịnh tiến và co giãn, không
 * xoay, và mũi tên chỉ có khi hướng đặt giữ chiều cao danh nghĩa thẳng đứng. Dấu màu tối trộn `MARK_STRENGTH` lên màu kiện, nên màu
 * điểm giao vẫn đọc được. Tier low dùng Lambert không atlas: không có dấu (thẻ kiện đang chọn nói bằng chữ).
 */
const TILE = 128
const TILES = 6
export const CARGO_SURFACE_KEY = 'cargo-surface-atlas-v2'
const MARK_MAX_M = 0.16
const MARK_MIN_M = 0.04
const MARK_FILL = 0.55
const MARK_STRENGTH = 0.55

/** Ly có vết nứt (ISO 7000-0621) trong ô `size` × `size`, góc trên trái ở (x, y). */
function drawGlass(context: CanvasRenderingContext2D, x: number, y: number, size: number) {
  context.save(); context.translate(x, y); context.scale(size / 128, size / 128)
  context.lineWidth = 8; context.lineJoin = 'round'; context.lineCap = 'round'
  context.beginPath()
  context.moveTo(36, 14); context.lineTo(92, 14)
  context.bezierCurveTo(94, 52, 86, 70, 64, 75)
  context.bezierCurveTo(42, 70, 34, 52, 36, 14)
  context.stroke()
  context.beginPath(); context.moveTo(64, 75); context.lineTo(64, 106); context.moveTo(42, 112); context.lineTo(86, 112); context.stroke()
  context.lineWidth = 6
  context.beginPath(); context.moveTo(58, 16); context.lineTo(70, 33); context.lineTo(57, 44); context.lineTo(69, 60); context.stroke()
  context.restore()
}

/** Hai mũi tên hướng lên trên một vạch đáy (ISO 7000-0623) trong ô `size` × `size`. */
function drawArrows(context: CanvasRenderingContext2D, x: number, y: number, size: number) {
  context.save(); context.translate(x, y); context.scale(size / 128, size / 128)
  context.lineWidth = 9; context.lineCap = 'butt'
  for (const cx of [42, 86]) {
    context.beginPath(); context.moveTo(cx, 104); context.lineTo(cx, 40); context.stroke()
    context.beginPath(); context.moveTo(cx - 18, 48); context.lineTo(cx, 16); context.lineTo(cx + 18, 48); context.closePath(); context.fill()
  }
  context.beginPath(); context.moveTo(18, 114); context.lineTo(110, 114); context.stroke()
  context.restore()
}

export function createCargoSurface() {
  const canvas = document.createElement('canvas')
  canvas.width = TILE * TILES; canvas.height = TILE
  const context = canvas.getContext('2d')!
  const pixels = context.createImageData(TILE * 3, TILE)
  for (let i = 0; i < TILE * 3 * TILE; i++) {
    const value = 245 + ((i * 73 + (i >>> 7) * 19) % 10)
    pixels.data.set([value, value, value, 255], i * 4)
  }
  context.putImageData(pixels, 0, 0)
  for (let tile = 0; tile < 3; tile++) {
    context.save(); context.translate(tile * TILE, 0)
    context.strokeStyle = 'rgba(0,0,0,0.16)'; context.lineWidth = 2
    context.strokeRect(2, 2, 124, 124)
    if (tile === 0) {
      context.fillStyle = 'rgba(255,255,255,0.3)'; context.fillRect(55, 0, 18, 128)
      context.lineWidth = 1
      for (const x of [55, 73]) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, 128); context.stroke() }
    } else {
      context.lineWidth = tile === 1 ? 5 : 2
      for (let y = 20; y < 128; y += tile === 1 ? 24 : 18) { context.beginPath(); context.moveTo(2, y); context.lineTo(126, y); context.stroke() }
      if (tile === 2) { context.lineWidth = 9; context.strokeRect(10, 10, 108, 108); context.beginPath(); context.moveTo(10, 10); context.lineTo(118, 118); context.stroke() }
    }
    context.restore()
  }
  // Ba ô dấu: nền trong suốt, hình đen đặc — shader trộn theo alpha. Ô thứ ba: ly bên trái, mũi tên bên phải, mỗi hình 62 % ô
  context.strokeStyle = 'rgb(0,0,0)'; context.fillStyle = 'rgb(0,0,0)'
  const pad = 6, half = TILE * 0.62
  drawGlass(context, TILE * 3 + pad, pad, TILE - pad * 2)
  drawArrows(context, TILE * 4 + pad, pad, TILE - pad * 2)
  drawGlass(context, TILE * 5 - TILE * 0.1, (TILE - half) / 2, half)
  drawArrows(context, TILE * 5 + TILE * 0.44, (TILE - half) / 2, half)
  const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace
  return texture
}

const glsl = (value: number) => value.toFixed(4)

// Existing Three r186 uv_vertex / map_fragment hooks; one per-instance scalar, no extra materials/draws.
export const applyCargoSurface: MeshStandardMaterial['onBeforeCompile'] = (shader) => {
  shader.vertexShader = 'attribute float packageSurface;\nvarying vec2 vMarkUv;\nvarying float vMark;\n' + shader.vertexShader
  shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>
#ifdef USE_MAP
  float surfaceMark = floor((packageSurface + 0.5) / 3.0);
  float surfaceBase = packageSurface - surfaceMark * 3.0;
  vMapUv.x = (clamp(vMapUv.x, 0.015, 0.985) + surfaceBase) / ${glsl(TILES)};
  vMark = 0.0;
  vMarkUv = vec2(-1.0);
  #ifdef USE_INSTANCING
  vec3 boxSize = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
  bool alongZ = abs(normal.x) > 0.5;
  float faceWidth = alongZ ? boxSize.z : boxSize.x;
  float markSize = min(${glsl(MARK_MAX_M)}, ${glsl(MARK_FILL)} * min(faceWidth, boxSize.y));
  if (abs(normal.y) < 0.5 && surfaceMark > 0.5 && markSize > ${glsl(MARK_MIN_M)}) {
    vMark = surfaceMark;
    vMarkUv = vec2((alongZ ? position.z : position.x) * faceWidth, position.y * boxSize.y) / markSize + 0.5;
  }
  #endif
#endif`)
  shader.fragmentShader = 'varying vec2 vMarkUv;\nvarying float vMark;\n' + shader.fragmentShader
  shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#ifdef USE_MAP
  vec4 sampledDiffuseColor = texture2D( map, vMapUv );
  vec2 markUv = clamp(vMarkUv, 0.01, 0.99);
  vec4 markColor = texture2D( map, vec2((markUv.x + 2.0 + vMark) / ${glsl(TILES)}, markUv.y) );
  float markInside = step(0.0, vMarkUv.x) * step(vMarkUv.x, 1.0) * step(0.0, vMarkUv.y) * step(vMarkUv.y, 1.0) * step(0.5, vMark);
  sampledDiffuseColor.rgb = mix(sampledDiffuseColor.rgb, markColor.rgb, markColor.a * markInside * ${glsl(MARK_STRENGTH)});
  diffuseColor *= sampledDiffuseColor;
#endif`)
}
