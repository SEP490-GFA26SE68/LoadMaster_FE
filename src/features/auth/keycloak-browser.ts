/** Phần của phiên Keycloak chạm vào trình duyệt: URL và chuyển trang của đường dự phòng PKCE, chuỗi ngẫu nhiên, SHA-256. */

/** Chỗ dự phòng chạm vào trình duyệt: đọc URL hiện tại, chuyển trang, xoá `code` khỏi URL. Test truyền bản giả. */
export type RedirectPort = {
  href(): string
  assign(url: string): void
  replace(url: string): void
}

export function browserRedirect(): RedirectPort | null {
  if (typeof window === 'undefined') return null
  return {
    href: () => window.location.href,
    assign: (url) => window.location.assign(url),
    replace: (url) => window.history.replaceState(window.history.state, '', url),
  }
}

export function randomText(bytes: number): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(bytes)))
}

function base64Url(bytes: Uint8Array): string {
  let text = ''
  for (const byte of bytes) text += String.fromCharCode(byte)
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function challengeOf(verifier: string): Promise<string> {
  return base64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))))
}
