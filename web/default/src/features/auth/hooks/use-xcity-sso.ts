import { useStatus } from '@/hooks/use-status'

const DEFAULT_LABEL = 'XCity'
const DEFAULT_DASHBOARD_URL = 'https://xcity.one/dashboard'
const DEFAULT_SIGNUP_URL = 'https://auth.xcity.one'

const pickFlag = (
  ...values: Array<unknown>
): boolean => values.some((v) => v === true)

const pickString = (
  ...values: Array<unknown>
): string | undefined => {
  for (const v of values) {
    if (typeof v === 'string' && v.trim() !== '') return v
  }
  return undefined
}

export type XCitySSO = {
  enabled: boolean
  providerLabel: string
  dashboardUrl: string
  signupUrl: string
}

/**
 * Centralized accessor for the XCity SSO configuration emitted by /api/status.
 * When `enabled` is true the app should treat auth.xcity.one as the sole login
 * entry, and surface the listed URLs for off-app account management.
 */
export function useXCitySSO(): XCitySSO {
  const { status } = useStatus()
  const enabled = pickFlag(
    status?.xcity_sso_enabled,
    status?.data?.xcity_sso_enabled
  )
  const providerLabel =
    pickString(
      status?.xcity_provider_label,
      status?.data?.xcity_provider_label
    ) ?? DEFAULT_LABEL
  const dashboardUrl =
    pickString(
      status?.xcity_dashboard_url,
      status?.data?.xcity_dashboard_url
    ) ?? DEFAULT_DASHBOARD_URL
  const signupUrl =
    pickString(status?.xcity_signup_url, status?.data?.xcity_signup_url) ??
    DEFAULT_SIGNUP_URL
  return { enabled, providerLabel, dashboardUrl, signupUrl }
}
