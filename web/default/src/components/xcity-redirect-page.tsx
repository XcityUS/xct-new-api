import { ExternalLink } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

type XcityRedirectPageProps = {
  dashboardUrl: string
  providerLabel: string
  /** Translated message describing why the local page is unavailable. */
  reason?: string
}

/**
 * Stand-in body shown for routes whose data lives on xcity.one when
 * `xcity.sso_enabled` is true (e.g. /wallet, /pricing). Renders a single
 * call-to-action that bounces the user to the off-app dashboard.
 */
export function XcityRedirectPage({
  dashboardUrl,
  providerLabel,
  reason,
}: XcityRedirectPageProps) {
  const { t } = useTranslation()
  return (
    <div className='mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-16 text-center'>
      <h2 className='text-xl font-semibold tracking-tight'>
        {t('Managed on {{name}}', { name: providerLabel })}
      </h2>
      <p className='text-muted-foreground text-sm'>
        {reason ??
          t(
            'This page lives on your {{name}} account dashboard. Open it to view and manage details.',
            { name: providerLabel }
          )}
      </p>
      <Button asChild className='gap-1.5'>
        <a href={dashboardUrl} target='_blank' rel='noopener noreferrer'>
          <ExternalLink className='size-4' />
          {t('Open {{name}} dashboard', { name: providerLabel })}
        </a>
      </Button>
    </div>
  )
}
