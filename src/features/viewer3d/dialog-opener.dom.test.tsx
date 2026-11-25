import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect } from 'react'
import { expect, test } from 'vitest'
import { useDialogHost, useDialogOpener, type DialogOpener } from './dialog-opener'

function Host({ opener }: { opener: DialogOpener }) {
  const [open, setOpen] = useDialogHost(opener)
  return open ? <button type="button" onClick={() => setOpen(false)}>Đóng</button> : null
}

test('mở / đóng hộp thoại chỉ vẽ lại hộp thoại, không vẽ lại nơi giữ lối mở', async () => {
  const user = userEvent.setup()
  const sessionRenders: string[] = []
  function Session() {
    const opener = useDialogOpener()
    // Effect không deps chạy sau mỗi lần chính phiên vẽ lại
    useEffect(() => { sessionRenders.push('render') })
    return <><button type="button" onClick={opener.open}>Mở</button><Host opener={opener} /></>
  }
  render(<Session />)
  await user.click(screen.getByRole('button', { name: 'Mở' }))
  expect(screen.getByRole('button', { name: 'Đóng' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Đóng' }))
  expect(screen.queryByRole('button', { name: 'Đóng' })).not.toBeInTheDocument()
  expect(sessionRenders).toEqual(['render'])
})

test('hộp thoại đã gỡ thì lối mở không làm gì', async () => {
  const user = userEvent.setup()
  function Session({ withHost }: { withHost: boolean }) {
    const opener = useDialogOpener()
    return <><button type="button" onClick={opener.open}>Mở</button>{withHost ? <Host opener={opener} /> : null}</>
  }
  const { rerender } = render(<Session withHost />)
  rerender(<Session withHost={false} />)
  await user.click(screen.getByRole('button', { name: 'Mở' }))
  expect(screen.queryByRole('button', { name: 'Đóng' })).not.toBeInTheDocument()
})
