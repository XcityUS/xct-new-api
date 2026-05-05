import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SignUp } from './index'

const useStatusMock = vi.fn(() => ({ status: {} }))
vi.mock('@/hooks/use-status', () => ({
  useStatus: () => useStatusMock(),
}))

const useXCitySSOMock = vi.fn()
vi.mock('../hooks/use-xcity-sso', () => ({
  useXCitySSO: () => useXCitySSOMock(),
}))

const navigateMock = vi.fn()
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
  Link: ({
    children,
    to,
  }: {
    children: React.ReactNode
    to: string
  }) => <a href={to}>{children}</a>,
}))

vi.mock('../auth-layout', () => ({
  AuthLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid='auth-layout'>{children}</div>
  ),
}))

vi.mock('../components/terms-footer', () => ({
  TermsFooter: () => <div data-testid='terms' />,
}))

vi.mock('./components/sign-up-form', () => ({
  SignUpForm: () => <div data-testid='sign-up-form' />,
}))

const replaceMock = vi.fn()
const originalLocation = window.location

beforeEach(() => {
  // window.location.replace is the redirect verb under test — replace the
  // whole `location` so we can spy on it without JSDOM throwing about
  // navigation.
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...originalLocation, replace: replaceMock },
  })
})

afterEach(() => {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: originalLocation,
  })
})

describe('SignUp', () => {
  it('renders the local form when SSO mode is off', () => {
    useXCitySSOMock.mockReturnValue({
      enabled: false,
      providerLabel: 'XCity',
      dashboardUrl: 'https://xcity.one/dashboard',
      signupUrl: 'https://auth.xcity.one',
    })

    render(<SignUp />)

    expect(screen.getByTestId('sign-up-form')).toBeInTheDocument()
    expect(replaceMock).not.toHaveBeenCalled()
  })

  it('redirects to xcity.signupUrl when SSO mode is on', () => {
    useXCitySSOMock.mockReturnValue({
      enabled: true,
      providerLabel: 'XCity',
      dashboardUrl: 'https://xcity.one/dashboard',
      signupUrl: 'https://auth.xcity.one/signup',
    })

    render(<SignUp />)

    expect(replaceMock).toHaveBeenCalledExactlyOnceWith(
      'https://auth.xcity.one/signup'
    )
    // Local form must not render even briefly.
    expect(screen.queryByTestId('sign-up-form')).not.toBeInTheDocument()
    // Fallback link visible for users whose redirect was blocked.
    expect(
      screen.getByRole('link', { name: 'https://auth.xcity.one/signup' })
    ).toHaveAttribute('href', 'https://auth.xcity.one/signup')
  })

  it('does not redirect again on rerender if signupUrl is unchanged', () => {
    useXCitySSOMock.mockReturnValue({
      enabled: true,
      providerLabel: 'XCity',
      dashboardUrl: 'https://xcity.one/dashboard',
      signupUrl: 'https://auth.xcity.one',
    })

    const { rerender } = render(<SignUp />)
    rerender(<SignUp />)
    rerender(<SignUp />)

    expect(replaceMock).toHaveBeenCalledTimes(1)
  })
})
