import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ProfileDropdown } from './profile-dropdown'

const useXCitySSOMock = vi.fn()
vi.mock('@/features/auth/hooks/use-xcity-sso', () => ({
  useXCitySSO: () => useXCitySSOMock(),
}))

vi.mock('@/stores/auth-store', () => ({
  useAuthStore: (selector: (s: { auth: { user: unknown } }) => unknown) =>
    selector({
      auth: {
        user: { id: 1, username: 'alice', role: 1, group: 'default' },
      },
    }),
}))

vi.mock('@/hooks/use-user-display', () => ({
  useUserDisplay: () => ({
    displayName: 'alice',
    initials: 'AL',
    roleLabel: 'User',
  }),
}))

vi.mock('@/hooks/use-dialog', () => ({
  default: () => [false, vi.fn()],
}))

vi.mock('@/components/sign-out-dialog', () => ({
  SignOutDialog: () => null,
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

// Force the Sheet open so its contents render — Radix's Sheet uses a portal
// that gates content behind the trigger click otherwise.
vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SheetTrigger: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  SheetContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SheetHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SheetTitle: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SheetClose: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

describe('ProfileDropdown', () => {
  it('shows the local Wallet link in normal mode', () => {
    useXCitySSOMock.mockReturnValue({
      enabled: false,
      providerLabel: 'XCity',
      dashboardUrl: 'https://xcity.one/dashboard',
      signupUrl: 'https://auth.xcity.one',
    })

    render(<ProfileDropdown />)

    const wallet = screen.getByRole('link', { name: /Wallet/i })
    expect(wallet).toHaveAttribute('href', '/wallet')
    // The off-app link MUST NOT appear in normal mode.
    expect(
      screen.queryByRole('link', { name: /Manage account on/i })
    ).not.toBeInTheDocument()
  })

  it('replaces Wallet with the off-app XCity link in SSO mode', () => {
    useXCitySSOMock.mockReturnValue({
      enabled: true,
      providerLabel: 'XCity',
      dashboardUrl: 'https://xcity.one/dashboard',
      signupUrl: 'https://auth.xcity.one',
    })

    render(<ProfileDropdown />)

    const xcity = screen.getByRole('link', {
      name: /Manage account on XCity/i,
    })
    expect(xcity).toHaveAttribute('href', 'https://xcity.one/dashboard')
    expect(xcity).toHaveAttribute('target', '_blank')
    expect(xcity).toHaveAttribute('rel', 'noopener noreferrer')
    // Local wallet link is gone.
    expect(
      screen.queryByRole('link', { name: /^Wallet$/i })
    ).not.toBeInTheDocument()
  })
})
