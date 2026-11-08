import { describe, expect, test } from 'vitest'
import { suggestCompanyCode } from './TrialRequestForms'

describe('suggestCompanyCode', () => {
  test('generates clean acronym for long names instead of truncated prefixes', () => {
    // Tên đầy đủ có tiền tố Công ty Cổ phần... không bao giờ sinh ra CONG_TY_CO_PHAN_\
    const code = suggestCompanyCode('Công ty Cổ phần Vận tải Tân Cảng Sài Gòn')
    expect(code).not.toContain('CONG_TY')
    expect(code).not.toContain('CO_PHAN')
    expect(code).not.toMatch(/[_\\]$/)
    expect(code).toMatch(/^[A-Za-z0-9_-]{3,50}$/)
    expect(code).toBe('TCSG_LOG')
  })

  test('generates clean identifier for medium names', () => {
    const code = suggestCompanyCode('Công ty TNHH Vận tải Anpha Express')
    expect(code).not.toContain('CONG_TY')
    expect(code).not.toContain('TNHH')
    expect(code).not.toMatch(/[_\\]$/)
    expect(code).toMatch(/^[A-Za-z0-9_-]{3,50}$/)
    expect(code).toBe('ANPHA_EXPRESS')
  })

  test('generates valid code for short names', () => {
    const code = suggestCompanyCode('Công ty ABC')
    expect(code).toBe('ABC_LOG')
    expect(code).toMatch(/^[A-Za-z0-9_-]{3,50}$/)
  })

  test('handles null or empty input gracefully', () => {
    expect(suggestCompanyCode(null)).toBe('')
    expect(suggestCompanyCode('')).toBe('')
    expect(suggestCompanyCode('   ')).toBe('')
  })
})
