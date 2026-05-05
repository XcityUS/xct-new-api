import z from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { Pricing } from '@/features/pricing'
import { XcityRedirectPage } from '@/components/xcity-redirect-page'
import { useXCitySSO } from '@/features/auth/hooks/use-xcity-sso'

const pricingSearchSchema = z.object({
  search: z.string().optional(),
  sort: z.string().optional(),
  vendor: z.string().optional(),
  group: z.string().optional(),
  quotaType: z.string().optional(),
  endpointType: z.string().optional(),
  tag: z.string().optional(),
  tokenUnit: z.enum(['M', 'K']).optional(),
  view: z.enum(['card', 'table']).optional().catch(undefined),
  rechargePrice: z.boolean().optional(),
})

function PricingRoute() {
  const xcity = useXCitySSO()
  if (xcity.enabled) {
    return (
      <XcityRedirectPage
        dashboardUrl={xcity.dashboardUrl}
        providerLabel={xcity.providerLabel}
      />
    )
  }
  return <Pricing />
}

export const Route = createFileRoute('/pricing/')({
  validateSearch: pricingSearchSchema,
  component: PricingRoute,
})
