import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// Run after every test so JSDOM state from one case doesn't bleed into the next.
afterEach(() => {
  cleanup()
})

// react-i18next is the heaviest dependency that the SSO components reach for.
// Real i18n initialization isn't needed to assert behavior — replace useTranslation
// with a stub that performs simple {{name}} interpolation so the rendered text
// is predictable and inspectable in tests.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) => {
      if (!vars) return key
      return Object.entries(vars).reduce<string>(
        (acc, [k, v]) => acc.replace(new RegExp(`{{\\s*${k}\\s*}}`, 'g'), String(v)),
        key
      )
    },
    i18n: { language: 'en', changeLanguage: () => Promise.resolve() },
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
  initReactI18next: { type: '3rdParty', init: () => undefined },
}))
