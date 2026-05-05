import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useXCitySSO } from './use-xcity-sso'

// useStatus is the only dependency — replacing it lets us drive the hook
// through every reasonable shape of /api/status output.
const useStatusMock = vi.fn()
vi.mock('@/hooks/use-status', () => ({
  useStatus: () => useStatusMock(),
}))

describe('useXCitySSO', () => {
  it('returns disabled defaults when status is empty', () => {
    useStatusMock.mockReturnValue({ status: null })

    const { result } = renderHook(() => useXCitySSO())

    expect(result.current.enabled).toBe(false)
    expect(result.current.providerLabel).toBe('XCity')
    expect(result.current.dashboardUrl).toBe('https://xcity.one/dashboard')
    expect(result.current.signupUrl).toBe('https://auth.xcity.one')
  })

  it('reads top-level fields when present', () => {
    useStatusMock.mockReturnValue({
      status: {
        xcity_sso_enabled: true,
        xcity_provider_label: 'Acme SSO',
        xcity_dashboard_url: 'https://acme.test/dashboard',
        xcity_signup_url: 'https://acme.test/signup',
      },
    })

    const { result } = renderHook(() => useXCitySSO())

    expect(result.current.enabled).toBe(true)
    expect(result.current.providerLabel).toBe('Acme SSO')
    expect(result.current.dashboardUrl).toBe('https://acme.test/dashboard')
    expect(result.current.signupUrl).toBe('https://acme.test/signup')
  })

  it('falls back to nested data.* fields when top-level is missing', () => {
    useStatusMock.mockReturnValue({
      status: {
        data: {
          xcity_sso_enabled: true,
          xcity_provider_label: 'Nested Label',
          xcity_dashboard_url: 'https://nested.test/dash',
          xcity_signup_url: 'https://nested.test/signup',
        },
      },
    })

    const { result } = renderHook(() => useXCitySSO())

    expect(result.current.enabled).toBe(true)
    expect(result.current.providerLabel).toBe('Nested Label')
    expect(result.current.dashboardUrl).toBe('https://nested.test/dash')
    expect(result.current.signupUrl).toBe('https://nested.test/signup')
  })

  it('prefers top-level over nested data.* on conflict', () => {
    useStatusMock.mockReturnValue({
      status: {
        xcity_provider_label: 'Top',
        data: { xcity_provider_label: 'Nested' },
      },
    })

    const { result } = renderHook(() => useXCitySSO())

    expect(result.current.providerLabel).toBe('Top')
  })

  it('treats only literal true as enabled (truthy strings do not count)', () => {
    useStatusMock.mockReturnValue({
      status: { xcity_sso_enabled: 'true' as unknown as boolean },
    })

    const { result } = renderHook(() => useXCitySSO())

    // pickFlag uses strict === true to avoid accidentally enabling SSO mode
    // on stale string values from the option table.
    expect(result.current.enabled).toBe(false)
  })

  it('falls back to default for empty/whitespace strings', () => {
    useStatusMock.mockReturnValue({
      status: {
        xcity_provider_label: '',
        xcity_dashboard_url: '   ',
        xcity_signup_url: '',
      },
    })

    const { result } = renderHook(() => useXCitySSO())

    expect(result.current.providerLabel).toBe('XCity')
    expect(result.current.signupUrl).toBe('https://auth.xcity.one')
    expect(result.current.dashboardUrl).toBe('https://xcity.one/dashboard')
  })
})
