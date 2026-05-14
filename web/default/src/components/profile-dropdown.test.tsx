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
  useNavigate: () => vi.fn(),
}))

// Pass-through DropdownMenu primitives so menu items render inline (no portal,
// no trigger click required). `DropdownMenuItem` honors Base UI's `render` prop
// so the test can assert against the resulting <a> for the XCity case.
vi.mock('@/components/ui/dropdown-menu', () => {
  type ItemProps = {
    children?: React.ReactNode
    render?: React.ReactElement
  } & Record<string, unknown>

  const PassThrough = ({ children }: { children?: React.ReactNode }) => (
    <>{children}</>
  )

  const DropdownMenuItem = ({ children, render: renderProp, ...rest }: ItemProps) => {
    if (renderProp) {
      const Element = renderProp.type as React.ElementType
      return (
        <Element {...renderProp.props} {...rest}>
          {children}
        </Element>
      )
    }
    return (
      <button type='button' {...rest}>
        {children}
      </button>
    )
  }

  return {
    DropdownMenu: PassThrough,
    DropdownMenuTrigger: PassThrough,
    DropdownMenuContent: PassThrough,
    DropdownMenuItem,
    DropdownMenuSeparator: () => null,
  }
})

describe('ProfileDropdown', () => {
  it('shows the local Wallet menu item in normal mode', () => {
    useXCitySSOMock.mockReturnValue({
      enabled: false,
      providerLabel: 'XCity',
      dashboardUrl: 'https://xcity.one/dashboard',
      signupUrl: 'https://auth.xcity.one',
    })

    render(<ProfileDropdown />)

    // Wallet is a button (navigates via onClick), not an anchor, in normal mode.
    expect(screen.getByRole('button', { name: /Wallet/i })).toBeInTheDocument()
    // The off-app XCity link MUST NOT appear in normal mode.
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
    // Local wallet button is gone.
    expect(
      screen.queryByRole('button', { name: /^Wallet$/i })
    ).not.toBeInTheDocument()
  })
})
