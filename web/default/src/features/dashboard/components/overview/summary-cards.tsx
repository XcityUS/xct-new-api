import { useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { CreditCard, ExternalLink } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth-store'
import { getCurrencyLabel, isCurrencyDisplayEnabled } from '@/lib/currency'
import { formatNumber, formatQuota } from '@/lib/format'
import { useStatus } from '@/hooks/use-status'
import { Button } from '@/components/ui/button'
import { StaggerContainer, StaggerItem } from '@/components/page-transition'
import { useSummaryCardsConfig } from '@/features/dashboard/hooks/use-dashboard-config'
import { useXCitySSO } from '@/features/auth/hooks/use-xcity-sso'
import { StatCard } from '../ui/stat-card'

export function SummaryCards() {
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.auth.user)
  const { status, loading } = useStatus()
  const xcity = useXCitySSO()

  // XCity SSO mode: balance/quota/usage live on xcity.one — replace the
  // numeric stat row with a single banner pointing the user there.
  if (xcity.enabled) {
    return (
      <div className='flex flex-col items-start justify-between gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:p-5'>
        <div className='space-y-1'>
          <p className='text-sm font-medium'>
            {t('Account balance and usage live on {{name}}', {
              name: xcity.providerLabel,
            })}
          </p>
          <p className='text-muted-foreground text-xs'>
            {t(
              'Top up, view usage, and manage billing from your {{name}} dashboard.',
              { name: xcity.providerLabel }
            )}
          </p>
        </div>
        <Button asChild size='sm' className='gap-1.5'>
          <a
            href={xcity.dashboardUrl}
            target='_blank'
            rel='noopener noreferrer'
          >
            <ExternalLink className='size-3.5' />
            {t('Open {{name}} dashboard', { name: xcity.providerLabel })}
          </a>
        </Button>
      </div>
    )
  }

  const summaryValues = useMemo(() => {
    const remainQuota = Number(user?.quota ?? 0)
    const usedQuota = Number(user?.used_quota ?? 0)
    const requestCount = Number(user?.request_count ?? 0)

    return {
      remainDisplay: formatQuota(remainQuota),
      usedDisplay: formatQuota(usedQuota),
      requestCountDisplay: formatNumber(requestCount),
    }
  }, [user])

  const currencyEnabledFromStore = isCurrencyDisplayEnabled()
  const statusCurrencyFlag =
    typeof status?.display_in_currency === 'boolean'
      ? Boolean(status.display_in_currency)
      : undefined
  const currencyEnabled =
    statusCurrencyFlag !== undefined
      ? statusCurrencyFlag
      : currencyEnabledFromStore
  const currencyLabel = currencyEnabled ? getCurrencyLabel() : 'Tokens'

  const items = useSummaryCardsConfig({
    ...summaryValues,
    currencyEnabled,
    currencyLabel,
  }).map((config, index) => ({
    title: config.title,
    value: config.value,
    desc: config.description,
    icon: config.icon,
    isBalance: index === 0,
  }))

  return (
    <div className='overflow-hidden rounded-lg border'>
      <StaggerContainer className='divide-border/60 grid grid-cols-3 divide-x'>
        {items.map((it) => (
          <StaggerItem key={it.title} className='px-3 py-3 sm:px-5 sm:py-4'>
            <StatCard
              title={it.title}
              value={it.value}
              description={it.desc}
              icon={it.icon}
              loading={loading}
              action={
                it.isBalance ? (
                  <Button
                    variant='outline'
                    size='sm'
                    className='hidden h-6 gap-1 px-2 text-xs sm:inline-flex'
                    asChild
                  >
                    <Link to='/wallet'>
                      <CreditCard className='size-3' />
                      {t('Recharge')}
                    </Link>
                  </Button>
                ) : undefined
              }
            />
          </StaggerItem>
        ))}
      </StaggerContainer>
    </div>
  )
}
