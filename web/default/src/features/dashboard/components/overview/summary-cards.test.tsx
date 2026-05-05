import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SummaryCards } from './summary-cards'

const useStatusMock = vi.fn(() => ({ status: {}, loading: false }))
vi.mock('@/hooks/use-status', () => ({
  useStatus: () => useStatusMock(),
}))

const useAuthStoreMock = vi.fn(() => ({
  quota: 1000,
  used_quota: 200,
  request_count: 5,
}))
vi.mock('@/stores/auth-store', () => ({
  useAuthStore: (selector: (s: { auth: { user: unknown } }) => unknown) =>
    selector({ auth: { user: useAuthStoreMock() } }),
}))

const useXCitySSOMock = vi.fn()
vi.mock('@/features/auth/hooks/use-xcity-sso', () => ({
  useXCitySSO: () => useXCitySSOMock(),
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
  }: {
    children: React.ReactNode
    to: string
  }) => <a href={to}>{children}</a>,
}))

vi.mock('@/components/page-transition', () => ({
  StaggerContainer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  StaggerItem: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}))

vi.mock('../ui/stat-card', () => ({
  StatCard: ({ title, value }: { title: string; value: string }) => (
    <div data-testid='stat-card'>
      <span>{title}</span>
      <span>{value}</span>
    </div>
  ),
}))

vi.mock('@/features/dashboard/hooks/use-dashboard-config', () => ({
  useSummaryCardsConfig: () => [
    {
      title: 'Balance',
      value: '$10',
      description: 'Remaining',
      icon: null,
    },
    {
      title: 'Used',
      value: '$2',
      description: 'Spent',
      icon: null,
    },
    {
      title: 'Requests',
      value: '5',
      description: 'Total',
      icon: null,
    },
  ],
}))

describe('SummaryCards', () => {
  it('renders three stat cards in normal mode', () => {
    useXCitySSOMock.mockReturnValue({
      enabled: false,
      providerLabel: 'XCity',
      dashboardUrl: 'https://xcity.one/dashboard',
      signupUrl: 'https://auth.xcity.one',
    })

    render(<SummaryCards />)

    expect(screen.getAllByTestId('stat-card')).toHaveLength(3)
    expect(screen.getByText('Balance')).toBeInTheDocument()
    // Dashboard banner MUST NOT render.
    expect(
      screen.queryByText(/Account balance and usage live on/i)
    ).not.toBeInTheDocument()
  })

  it('renders the off-app banner instead of stat cards in SSO mode', () => {
    useXCitySSOMock.mockReturnValue({
      enabled: true,
      providerLabel: 'XCity',
      dashboardUrl: 'https://xcity.one/dashboard',
      signupUrl: 'https://auth.xcity.one',
    })

    render(<SummaryCards />)

    // Numeric stat cards are gone…
    expect(screen.queryAllByTestId('stat-card')).toHaveLength(0)
    // …and the banner explains where the data went.
    expect(
      screen.getByText(/Account balance and usage live on XCity/i)
    ).toBeInTheDocument()
    const link = screen.getByRole('link', {
      name: /Open XCity dashboard/i,
    })
    expect(link).toHaveAttribute('href', 'https://xcity.one/dashboard')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })
})
