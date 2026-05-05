import { useEffect } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useStatus } from '@/hooks/use-status'
import { useXCitySSO } from '../hooks/use-xcity-sso'
import { AuthLayout } from '../auth-layout'
import { TermsFooter } from '../components/terms-footer'
import { SignUpForm } from './components/sign-up-form'

export function SignUp() {
  const { t } = useTranslation()
  const { status } = useStatus()
  const xcity = useXCitySSO()
  const navigate = useNavigate()

  // XCity SSO mode owns identity creation — bounce the visitor to xcity's
  // signup page rather than rendering the local form.
  useEffect(() => {
    if (!xcity.enabled) return
    if (typeof window === 'undefined') return
    window.location.replace(xcity.signupUrl)
  }, [xcity.enabled, xcity.signupUrl])

  if (xcity.enabled) {
    return (
      <AuthLayout>
        <div className='w-full space-y-4 text-center'>
          <h2 className='text-2xl font-semibold tracking-tight'>
            {t('Redirecting to {{name}}…', { name: xcity.providerLabel })}
          </h2>
          <p className='text-muted-foreground text-sm'>
            {t(
              'If you are not redirected automatically, follow the link below.'
            )}
          </p>
          <a
            href={xcity.signupUrl}
            className='hover:text-primary font-medium underline underline-offset-4'
          >
            {xcity.signupUrl}
          </a>
          <div className='pt-4'>
            <button
              type='button'
              onClick={() => void navigate({ to: '/sign-in' })}
              className='text-muted-foreground text-sm underline underline-offset-4'
            >
              {t('Back to sign in')}
            </button>
          </div>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <div className='w-full space-y-8'>
        <div className='space-y-2'>
          <h2 className='text-center text-2xl font-semibold tracking-tight sm:text-left'>
            {t('Create an account')}
          </h2>
          <p className='text-muted-foreground text-left text-sm sm:text-base'>
            {t('Already have an account?')}{' '}
            <Link
              to='/sign-in'
              className='hover:text-primary font-medium underline underline-offset-4'
            >
              {t('Sign in')}
            </Link>
            .
          </p>
        </div>

        <SignUpForm />

        <TermsFooter
          variant='sign-up'
          status={status}
          className='text-center'
        />
      </div>
    </AuthLayout>
  )
}
