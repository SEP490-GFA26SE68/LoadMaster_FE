import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { BRAND_TAGLINE, Logo } from './Logo'
import { LogoMark } from './LogoMark'

/** Logo LoadMaster (LM-105): tên truy cập một lần, biểu tượng là trang trí. */
test('the logo reads as one image named LoadMaster, with the tagline when asked', () => {
  const { container } = render(<Logo tagline />)
  expect(screen.getByRole('img', { name: 'LoadMaster' })).toBeInTheDocument()
  expect(container).toHaveTextContent(`LoadMaster${BRAND_TAGLINE}`)
  expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
})

test('a decorative logo inside a labelled link is hidden from assistive technology', () => {
  render(<a href="/" aria-label="Về trang chính"><Logo decorative /></a>)
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Về trang chính' })).toBeInTheDocument()
})

test('the mark draws the lid, the L and the n; on dark backgrounds the n turns white, mono follows the text colour', () => {
  const pieces = (tone: 'color' | 'dark' | 'mono') => {
    const { container, unmount } = render(<LogoMark tone={tone} />)
    const classes = [...container.querySelectorAll('path')].map((path) => path.getAttribute('class'))
    unmount()
    return classes
  }
  expect(pieces('color')).toHaveLength(3)
  expect(pieces('color')[2]).toContain('--logo-navy')
  expect(pieces('dark')[2]).toContain('--logo-on-dark')
  expect(pieces('mono').every((name) => name?.includes('fill-current'))).toBe(true)
})
