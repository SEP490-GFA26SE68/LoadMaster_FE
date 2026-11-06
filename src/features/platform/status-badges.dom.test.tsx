import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, test } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import { ServerCompanyStatusBadge, ServerPlanStatusBadge } from './server-companies-table'
import { TrialStatusBadge } from './trial-requests-table'

describe('Status Badges Internationalization (VI vs EN)', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  describe('TrialStatusBadge', () => {
    test('renders correct Vietnamese labels in VI mode', () => {
      window.sessionStorage.setItem('loadmaster.ngon-ngu', 'vi')
      const { unmount } = render(
        <I18nProvider key="vi-1">
          <TrialStatusBadge status="PENDING" />
        </I18nProvider>,
      )
      expect(screen.getByText('Chờ duyệt')).toBeInTheDocument()
      unmount()

      const { unmount: unmount2 } = render(
        <I18nProvider key="vi-2">
          <TrialStatusBadge status="APPROVED" />
        </I18nProvider>,
      )
      expect(screen.getByText('Đã duyệt')).toBeInTheDocument()
      unmount2()

      render(
        <I18nProvider key="vi-3">
          <TrialStatusBadge status="REJECTED" />
        </I18nProvider>,
      )
      expect(screen.getByText('Đã từ chối')).toBeInTheDocument()
    })

    test('renders correct English labels in EN mode', () => {
      window.sessionStorage.setItem('loadmaster.ngon-ngu', 'en')
      const { unmount } = render(
        <I18nProvider key="en-1">
          <TrialStatusBadge status="PENDING" />
        </I18nProvider>,
      )
      expect(screen.getByText('Awaiting review')).toBeInTheDocument()
      unmount()

      const { unmount: unmount2 } = render(
        <I18nProvider key="en-2">
          <TrialStatusBadge status="APPROVED" />
        </I18nProvider>,
      )
      expect(screen.getByText('Approved')).toBeInTheDocument()
      unmount2()

      render(
        <I18nProvider key="en-3">
          <TrialStatusBadge status="REJECTED" />
        </I18nProvider>,
      )
      expect(screen.getByText('Rejected')).toBeInTheDocument()
    })
  })

  describe('ServerCompanyStatusBadge', () => {
    test('renders localized company statuses in VI', () => {
      window.sessionStorage.setItem('loadmaster.ngon-ngu', 'vi')
      const { unmount } = render(
        <I18nProvider key="vi-c1">
          <ServerCompanyStatusBadge status="ACTIVE" />
        </I18nProvider>,
      )
      expect(screen.getByText('Đang hoạt động')).toBeInTheDocument()
      unmount()

      const { unmount: unmount2 } = render(
        <I18nProvider key="vi-c2">
          <ServerCompanyStatusBadge status="SUSPENDED" />
        </I18nProvider>,
      )
      expect(screen.getByText('Tạm ngưng')).toBeInTheDocument()
      unmount2()

      render(
        <I18nProvider key="vi-c3">
          <ServerCompanyStatusBadge status="EXPIRED" />
        </I18nProvider>,
      )
      expect(screen.getByText('Hết hạn')).toBeInTheDocument()
    })

    test('renders localized company statuses in EN', () => {
      window.sessionStorage.setItem('loadmaster.ngon-ngu', 'en')
      const { unmount } = render(
        <I18nProvider key="en-c1">
          <ServerCompanyStatusBadge status="ACTIVE" />
        </I18nProvider>,
      )
      expect(screen.getByText('Active')).toBeInTheDocument()
      unmount()

      const { unmount: unmount2 } = render(
        <I18nProvider key="en-c2">
          <ServerCompanyStatusBadge status="SUSPENDED" />
        </I18nProvider>,
      )
      expect(screen.getByText('Suspended')).toBeInTheDocument()
      unmount2()

      render(
        <I18nProvider key="en-c3">
          <ServerCompanyStatusBadge status="EXPIRED" />
        </I18nProvider>,
      )
      expect(screen.getByText('Expired')).toBeInTheDocument()
    })
  })

  describe('ServerPlanStatusBadge', () => {
    test('renders localized plan statuses in VI and EN', () => {
      window.sessionStorage.setItem('loadmaster.ngon-ngu', 'vi')
      const { unmount } = render(
        <I18nProvider key="vi-p">
          <ServerPlanStatusBadge status="TRIAL" />
        </I18nProvider>,
      )
      expect(screen.getByText('Dùng thử')).toBeInTheDocument()
      unmount()

      window.sessionStorage.setItem('loadmaster.ngon-ngu', 'en')
      render(
        <I18nProvider key="en-p">
          <ServerPlanStatusBadge status="TRIAL" />
        </I18nProvider>,
      )
      expect(screen.getByText('Trial')).toBeInTheDocument()
    })
  })
})
