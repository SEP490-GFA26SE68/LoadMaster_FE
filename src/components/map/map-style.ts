import type { StyleSpecification } from 'maplibre-gl'

/**
 * Nền bản đồ (D-75): **chỉ Goong**. Không dùng nền OpenStreetMap hay bất kỳ nguồn gạch nào khác — không bảo đảm thể hiện Hoàng Sa,
 * Trường Sa theo quy định. Khoá map tiles lấy từ biến môi trường lúc build; khoá REST của Goong không bao giờ nằm ở FE.
 */
export const GOONG_STYLE_URL = 'https://tiles.goong.io/assets/goong_map_web.json'

/** Khoá map tiles của Goong, hoặc `undefined` khi chưa cấu hình (dev, CI, test). */
export function goongMapTilesKey(env: { readonly VITE_GOONG_MAPTILES_KEY?: string } = import.meta.env): string | undefined {
  const key = env.VITE_GOONG_MAPTILES_KEY?.trim()
  return key ? key : undefined
}

/** Style rỗng: một lớp nền màu phẳng, không nguồn dữ liệu, không font — không gọi mạng. Lớp dữ liệu của app vẽ lên trên. */
export function emptyStyle(background: string): StyleSpecification {
  return { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': background } }] }
}

/** Style nền: URL style `goong_map_web.json` khi có khoá, style rỗng khi không. */
export function baseStyle(key: string | undefined, background: string): string | StyleSpecification {
  return key ? `${GOONG_STYLE_URL}?api_key=${encodeURIComponent(key)}` : emptyStyle(background)
}
