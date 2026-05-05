import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { UserAuthForm } from './user-auth-form'

const useStatusMock = vi.fn()
vi.mock('@/hooks/use-status', () => ({
  useStatus: () => useStatusMock(),
}))

const useXCitySSOMock = vi.fn()
vi.mock('@/features/auth/hooks/use-xcity-sso', () => ({
  useXCitySSO: () => useXCitySSOMock(),
}))

// The OAuth-providers child does its own SSO logic; for this test we just
// need a sentinel so we can assert that the form delegates to it.
vi.mock('@/features/auth/components/oauth-providers', () => ({
  OAuthProviders: () => <div data-testid='oauth-providers' />,
}))

vi.mock('@/features/auth/components/legal-consent', () => ({
  LegalConsent: () => <div data-testid='legal-consent' />,
}))

vi.mock('@/features/auth/hooks/use-auth-redirect', () => ({
  useAuthRedirect: () => ({
    handleLoginSuccess: vi.fn(),
    redirectTo2FA: vi.fn(),
  }),
}))

vi.mock('@/features/auth/hooks/use-turnstile', () => ({
  useTurnstile: () => ({
    isTurnstileEnabled: false,
    turnstileSiteKey: '',
    turnstileToken: '',
    setTurnstileToken: vi.fn(),
    validateTurnstile: () => true,
  }),
}))

vi.mock('@/features/auth/api', () => ({
  login: vi.fn(),
  wechatLoginByCode: vi.fn(),
}))

vi.mock('@/features/auth/passkey', () => ({
  beginPasskeyLogin: vi.fn(),
  finishPasskeyLogin: vi.fn(),
}))

vi.mock('@/lib/passkey', () => ({
  buildAssertionResult: vi.fn(),
  prepareCredentialRequestOptions: vi.fn(),
  isPasskeySupported: () => Promise.resolve(false),
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

describe('UserAuthForm', () => {
  it('renders the username + password fields when SSO is off', () => {
    useStatusMock.mockReturnValue({ status: {} })
    useXCitySSOMock.mockReturnValue({
      enabled: false,
      providerLabel: 'XCity',
      dashboardUrl: 'https://xcity.one/dashboard',
      signupUrl: 'https://auth.xcity.one',
    })

    render(<UserAuthForm />)

    expect(screen.getByLabelText('Username or Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /^Sign in$/ })
    ).toBeInTheDocument()
  })

  it('renders only OAuth providers + legal consent when SSO is on', () => {
    useStatusMock.mockReturnValue({ status: {} })
    useXCitySSOMock.mockReturnValue({
      enabled: true,
      providerLabel: 'XCity',
      dashboardUrl: 'https://xcity.one/dashboard',
      signupUrl: 'https://auth.xcity.one',
    })

    render(<UserAuthForm />)

    // The username/password fields and submit button MUST be gone.
    expect(
      screen.queryByLabelText(/Username or Email/i)
    ).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Password/i)).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /^Sign in$/ })
    ).not.toBeInTheDocument()

    expect(screen.getByTestId('oauth-providers')).toBeInTheDocument()
    expect(screen.getByTestId('legal-consent')).toBeInTheDocument()
  })
})
