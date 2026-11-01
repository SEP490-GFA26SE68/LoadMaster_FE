import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import type { SubscriptionPlan } from '@/lib/mock-db'
import { PlanChoiceCard } from './PlanChoiceCard'

const SAMPLE_PLANS: SubscriptionPlan[] = [
  {
    id: '1',
    name: 'Basic',
    tier: 'BASIC',
    priceVnd: 1_000_000,
    monthlyCredits: 2000,
    algorithmTier: 'EP_DBLF',
    active: true,
    provisional: false,
    updatedAt: '2026-10-19T00:00:00Z',
  },
  {
    id: '2',
    name: 'Pro',
    tier: 'PRO',
    priceVnd: 2_500_000,
    monthlyCredits: 6000,
    algorithmTier: 'EP_DBLF_GA',
    active: true,
    provisional: false,
    updatedAt: '2026-10-19T00:00:00Z',
  },
  {
    id: '3',
    name: 'Enterprise',
    tier: 'ULTIMATE',
    priceVnd: 25_000_000,
    monthlyCredits: null,
    algorithmTier: 'HYBRID_GA_SA',
    active: true,
    provisional: false,
    updatedAt: '2026-10-19T00:00:00Z',
  },
]

test('Method 3B: when company has Basic plan (even if expired), Basic allows renewal while higher plans open Support Ticket dialog', async () => {
  const user = userEvent.setup()
  const onSubscribe = vi.fn()
  const onRequestUpgrade = vi.fn()

  render(
    <I18nProvider>
      <PlanChoiceCard
        plans={SAMPLE_PLANS}
        pendingId={null}
        currentPlanId="1"
        onSubscribe={onSubscribe}
        onRequestUpgrade={onRequestUpgrade}
      />
    </I18nProvider>,
  )

  const renewBasicBtn = screen.getByRole('button', { name: 'Gia hạn gói Basic' })
  const upgradeProBtn = screen.getByRole('button', { name: 'Gửi yêu cầu nâng cấp gói Pro' })
  const upgradeEnterpriseBtn = screen.getByRole('button', { name: 'Gửi yêu cầu nâng cấp gói Enterprise' })

  await user.click(renewBasicBtn)
  expect(onSubscribe).toHaveBeenCalledWith(SAMPLE_PLANS[0])
  expect(onRequestUpgrade).not.toHaveBeenCalled()

  await user.click(upgradeProBtn)
  expect(onRequestUpgrade).toHaveBeenCalledWith(SAMPLE_PLANS[1])
  expect(onSubscribe).toHaveBeenCalledTimes(1)

  await user.click(upgradeEnterpriseBtn)
  expect(onRequestUpgrade).toHaveBeenCalledWith(SAMPLE_PLANS[2])
})

test('When expired on Pro plan, Basic and Pro allow direct subscription/renewal while Ultimate requires upgrade ticket', async () => {
  const user = userEvent.setup()
  const onSubscribe = vi.fn()
  const onRequestUpgrade = vi.fn()

  render(
    <I18nProvider>
      <PlanChoiceCard
        plans={SAMPLE_PLANS}
        pendingId={null}
        currentPlanId="2"
        currentPlanTier="PRO"
        onSubscribe={onSubscribe}
        onRequestUpgrade={onRequestUpgrade}
      />
    </I18nProvider>,
  )

  const subscribeBasicBtn = screen.getByRole('button', { name: 'Đăng ký gói Basic' })
  const renewProBtn = screen.getByRole('button', { name: 'Gia hạn gói Pro' })
  const upgradeUltimateBtn = screen.getByRole('button', { name: 'Gửi yêu cầu nâng cấp gói Enterprise' })

  await user.click(subscribeBasicBtn)
  expect(onSubscribe).toHaveBeenCalledWith(SAMPLE_PLANS[0])

  await user.click(renewProBtn)
  expect(onSubscribe).toHaveBeenCalledWith(SAMPLE_PLANS[1])
  expect(onRequestUpgrade).not.toHaveBeenCalled()

  await user.click(upgradeUltimateBtn)
  expect(onRequestUpgrade).toHaveBeenCalledWith(SAMPLE_PLANS[2])
})

test('When expired on Ultimate plan, all 3 plans (Basic, Pro, Ultimate) allow direct subscription/renewal without ticket', async () => {
  const user = userEvent.setup()
  const onSubscribe = vi.fn()
  const onRequestUpgrade = vi.fn()

  render(
    <I18nProvider>
      <PlanChoiceCard
        plans={SAMPLE_PLANS}
        pendingId={null}
        currentPlanId="3"
        currentPlanTier="ULTIMATE"
        onSubscribe={onSubscribe}
        onRequestUpgrade={onRequestUpgrade}
      />
    </I18nProvider>,
  )

  const subscribeBasicBtn = screen.getByRole('button', { name: 'Đăng ký gói Basic' })
  const subscribeProBtn = screen.getByRole('button', { name: 'Đăng ký gói Pro' })
  const renewUltimateBtn = screen.getByRole('button', { name: 'Gia hạn gói Enterprise' })

  await user.click(subscribeBasicBtn)
  expect(onSubscribe).toHaveBeenCalledWith(SAMPLE_PLANS[0])

  await user.click(subscribeProBtn)
  expect(onSubscribe).toHaveBeenCalledWith(SAMPLE_PLANS[1])

  await user.click(renewUltimateBtn)
  expect(onSubscribe).toHaveBeenCalledWith(SAMPLE_PLANS[2])
  expect(onRequestUpgrade).not.toHaveBeenCalled()
})

