import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useTopNavLinks } from './use-top-nav-links'

const useStatusMock = vi.fn()
vi.mock('@/hooks/use-status', () => ({
  useStatus: () => useStatusMock(),
}))

const useAuthStoreMock = vi.fn()
vi.mock('@/stores/auth-store', () => ({
  useAuthStore: () => useAuthStoreMock(),
}))

const useXCitySSOMock = vi.fn()
vi.mock('@/features/auth/hooks/use-xcity-sso', () => ({
  useXCitySSO: () => useXCitySSOMock(),
}))

const baseStatus = {
  HeaderNavModules: JSON.stringify({
    home: true,
    console: true,
    pricing: { enabled: true, requireAuth: false },
    docs: true,
    about: true,
  }),
  docs_link: undefined,
}

const baseAuth = { auth: { user: null } }

describe('useTopNavLinks', () => {
  it('includes the pricing link when SSO mode is off', () => {
    useStatusMock.mockReturnValue({ status: baseStatus })
    useAuthStoreMock.mockReturnValue(baseAuth)
    useXCitySSOMock.mockReturnValue({ enabled: false })

    const { result } = renderHook(() => useTopNavLinks())

    const hrefs = result.current.map((l) => l.href)
    expect(hrefs).toContain('/pricing')
  })

  it('drops the pricing link when SSO mode is on', () => {
    useStatusMock.mockReturnValue({ status: baseStatus })
    useAuthStoreMock.mockReturnValue(baseAuth)
    useXCitySSOMock.mockReturnValue({ enabled: true })

    const { result } = renderHook(() => useTopNavLinks())

    const hrefs = result.current.map((l) => l.href)
    expect(hrefs).not.toContain('/pricing')
    // Other primary entries are still present.
    expect(hrefs).toContain('/')
    expect(hrefs).toContain('/dashboard')
    expect(hrefs).toContain('/about')
  })

  it('honors backend pricing.enabled=false even when SSO is off', () => {
    useStatusMock.mockReturnValue({
      status: {
        ...baseStatus,
        HeaderNavModules: JSON.stringify({
          home: true,
          console: true,
          pricing: { enabled: false, requireAuth: false },
          docs: true,
          about: true,
        }),
      },
    })
    useAuthStoreMock.mockReturnValue(baseAuth)
    useXCitySSOMock.mockReturnValue({ enabled: false })

    const { result } = renderHook(() => useTopNavLinks())

    expect(result.current.map((l) => l.href)).not.toContain('/pricing')
  })
})
