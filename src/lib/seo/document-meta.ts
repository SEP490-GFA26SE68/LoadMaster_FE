/**
 * Thẻ meta của màn đang mở, đặt lúc chạy (`app/route-title.ts`) — HTML tĩnh do plugin `seo` của `vite.config.ts` ghi chỉ đúng với trang
 * mở đầu tiên. Ba trang công khai mang mô tả theo ngôn ngữ đang chọn và canonical của chính trang; màn ứng dụng, màn đăng nhập và màn lỗi
 * không cần lên công cụ tìm kiếm: bỏ canonical, thêm `noindex`.
 */
export type DocumentMeta = {
  readonly description: string
  /** Địa chỉ tuyệt đối của trang; `null` là màn không có bản chuẩn (không lên công cụ tìm kiếm). */
  readonly canonical: string | null
}

function headElement<Tag extends 'meta' | 'link'>(tag: Tag, selector: string, attributes: Record<string, string>): HTMLElementTagNameMap[Tag] {
  const existing = document.head.querySelector<HTMLElementTagNameMap[Tag]>(selector)
  if (existing) return existing
  const element = document.createElement(tag)
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value)
  document.head.append(element)
  return element
}

export function applyDocumentMeta({ description, canonical }: DocumentMeta): void {
  headElement('meta', 'meta[name="description"]', { name: 'description' }).content = description
  if (canonical === null) {
    document.head.querySelector('link[rel="canonical"]')?.remove()
    headElement('meta', 'meta[name="robots"]', { name: 'robots' }).content = 'noindex'
  } else {
    headElement('link', 'link[rel="canonical"]', { rel: 'canonical' }).href = canonical
    document.head.querySelector('meta[name="robots"]')?.remove()
  }
}
