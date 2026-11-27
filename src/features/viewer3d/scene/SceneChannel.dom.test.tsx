import { act, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { createSceneChannel, SceneChannelContent } from './SceneChannel'

test('the channel hands its latest node to a new listener and only notifies on a new node', () => {
  const channel = createSceneChannel()
  const node = <span>cảnh</span>
  channel.set(node)
  const listener = vi.fn()
  const unsubscribe = channel.subscribe(listener)
  expect(listener).toHaveBeenLastCalledWith(node)
  channel.set(node)
  expect(listener).toHaveBeenCalledTimes(1)
  const next = <span>bước sau</span>
  channel.set(next)
  expect(listener).toHaveBeenCalledTimes(2)
  expect(listener).toHaveBeenLastCalledWith(next)
  expect(channel.get()).toBe(next)
  unsubscribe()
  channel.set(<span>khác</span>)
  expect(listener).toHaveBeenCalledTimes(2)
})

test('the reader shows a node set before it mounts and follows later nodes without its parent re-rendering', () => {
  const channel = createSceneChannel()
  channel.set(<span>bước 1</span>)
  const parentRender = vi.fn()
  function Parent() {
    parentRender()
    return <SceneChannelContent channel={channel} />
  }
  render(<Parent />)
  expect(screen.getByText('bước 1')).toBeInTheDocument()
  act(() => channel.set(<span>bước 2</span>))
  expect(screen.getByText('bước 2')).toBeInTheDocument()
  expect(parentRender).toHaveBeenCalledTimes(1)
})
