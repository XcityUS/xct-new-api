import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { OAuthProviders } from './oauth-providers'
import type { SystemStatus } from '../types'

const useXCitySSOMock = vi.fn()
vi.mock('../hooks/use-xcity-sso', () => ({
  useXCitySSO: () => useXCitySSOMock(),
}))

const handleOIDCLogin = vi.fn()
const handleGitHubLogin = vi.fn()
const useOAuthLoginMock = vi.fn(() => ({
  isLoading: false,
  githubButtonText: 'Continue with GitHub',
  githubButtonDisabled: false,
  handleGitHubLogin,
  handleDiscordLogin: vi.fn(),
  handleOIDCLogin,
  handleLinuxDOLogin: vi.fn(),
  handleTelegramLogin: vi.fn(),
  handleCustomOAuthLogin: vi.fn(),
}))
vi.mock('../hooks/use-oauth-login', () => ({
  useOAuthLogin: () => useOAuthLoginMock(),
}))

// Brand icons resolve to SVG in the real bundle; replace with sentinels so
// JSDOM doesn't complain about the icon assets.
vi.mock('@/assets/brand-icons', () => ({
  IconDiscord: () => null,
  IconGithub: () => null,
  IconLinuxDo: () => null,
  IconWeChat: () => null,
}))

describe('OAuthProviders', () => {
  const oidcEnabledStatus: SystemStatus = {
    oidc_enabled: true,
    oidc_client_id: 'client-1',
    oidc_authorization_endpoint: 'https://auth.xcity.one/authorize',
    github_oauth: true,
    github_client_id: 'gh-1',
  }

  it('in XCity SSO mode renders only the XCity primary button', async () => {
    useXCitySSOMock.mockReturnValue({
      enabled: true,
      providerLabel: 'XCity',
      dashboardUrl: 'https://xcity.one/dashboard',
      signupUrl: 'https://auth.xcity.one',
    })

    render(<OAuthProviders status={oidcEnabledStatus} />)

    const xcityButton = screen.getByRole('button', {
      name: 'Sign in with XCity',
    })
    expect(xcityButton).toBeInTheDocument()
    // GitHub MUST NOT be rendered alongside.
    expect(
      screen.queryByRole('button', { name: /github/i })
    ).not.toBeInTheDocument()

    await userEvent.click(xcityButton)
    expect(handleOIDCLogin).toHaveBeenCalledTimes(1)
  })

  it('in XCity SSO mode renders nothing if OIDC is not enabled', () => {
    useXCitySSOMock.mockReturnValue({
      enabled: true,
      providerLabel: 'XCity',
      dashboardUrl: 'https://xcity.one/dashboard',
      signupUrl: 'https://auth.xcity.one',
    })

    const { container } = render(
      <OAuthProviders status={{ oidc_enabled: false }} />
    )

    // The component returns null in standard mode when no providers are
    // configured; SSO+OIDC-disabled should fall through to that branch.
    expect(container.firstChild).toBeNull()
  })

  it('with SSO disabled falls back to the standard provider list', () => {
    useXCitySSOMock.mockReturnValue({
      enabled: false,
      providerLabel: 'XCity',
      dashboardUrl: 'https://xcity.one/dashboard',
      signupUrl: 'https://auth.xcity.one',
    })

    render(<OAuthProviders status={oidcEnabledStatus} />)

    expect(
      screen.getByRole('button', { name: /Continue with GitHub/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Continue with OIDC/i })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Sign in with XCity' })
    ).not.toBeInTheDocument()
  })
})
