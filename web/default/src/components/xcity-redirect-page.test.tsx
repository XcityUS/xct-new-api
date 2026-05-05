import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { XcityRedirectPage } from './xcity-redirect-page'

describe('XcityRedirectPage', () => {
  it('renders the default reason and a link to the dashboard', () => {
    render(
      <XcityRedirectPage
        dashboardUrl='https://xcity.one/dashboard'
        providerLabel='XCity'
      />
    )

    // Heading uses the {{name}} interpolation that the i18n stub resolves.
    expect(screen.getByText('Managed on XCity')).toBeInTheDocument()
    expect(
      screen.getByText(
        /This page lives on your XCity account dashboard/i
      )
    ).toBeInTheDocument()

    const link = screen.getByRole('link', {
      name: /Open XCity dashboard/i,
    })
    expect(link).toHaveAttribute('href', 'https://xcity.one/dashboard')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('uses a custom reason when provided', () => {
    render(
      <XcityRedirectPage
        dashboardUrl='https://acme.test/dash'
        providerLabel='Acme'
        reason='Wallets are paused for maintenance.'
      />
    )

    expect(
      screen.getByText('Wallets are paused for maintenance.')
    ).toBeInTheDocument()
    // Default reason text MUST NOT also appear.
    expect(
      screen.queryByText(/account dashboard/i)
    ).not.toBeInTheDocument()
  })
})
