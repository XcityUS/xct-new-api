import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { Wallet } from '@/features/wallet'
import { XcityRedirectPage } from '@/components/xcity-redirect-page'
import { useXCitySSO } from '@/features/auth/hooks/use-xcity-sso'

const walletSearchSchema = z.object({
  show_history: z.boolean().optional(),
})

export const Route = createFileRoute('/_authenticated/wallet/')({
  component: RouteComponent,
  validateSearch: walletSearchSchema,
})

function RouteComponent() {
  const { show_history } = Route.useSearch()
  const xcity = useXCitySSO()
  if (xcity.enabled) {
    return (
      <XcityRedirectPage
        dashboardUrl={xcity.dashboardUrl}
        providerLabel={xcity.providerLabel}
      />
    )
  }
  return <Wallet initialShowHistory={show_history} />
}
