import { useEffect, useState } from 'react'

/**
 * Lối mở một hộp thoại mà state "đang mở" nằm ở chính hộp thoại, không ở phiên Planner: mở / đóng chỉ vẽ lại hộp thoại, không vẽ lại
 * phiên (và cả cây R3F của khung 3D) bên trên. `open` giữ nguyên tham chiếu suốt đời phiên.
 */
export type DialogOpener = {
  readonly open: () => void
  /** Hộp thoại gắn setter của nó khi mount, gỡ khi unmount (`useDialogHost`). */
  readonly bind: (setOpen: ((open: boolean) => void) | null) => void
}

export function useDialogOpener(): DialogOpener {
  const [opener] = useState((): DialogOpener => {
    let setOpen: ((open: boolean) => void) | null = null
    return { open: () => setOpen?.(true), bind: (next) => { setOpen = next } }
  })
  return opener
}

/** State "đang mở" của hộp thoại, mở được từ xa qua `opener.open()`. */
export function useDialogHost(opener: DialogOpener): readonly [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    opener.bind(setOpen)
    return () => opener.bind(null)
  }, [opener])
  return [open, setOpen]
}
