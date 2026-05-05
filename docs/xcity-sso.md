# XCity SSO Contract

This document is the integration contract between `auth.xcity.one`,
`xct-new-api` (this repository), and the `Xcity-Chat` frontend. It exists so
both sides of the SSO link implement the same expectations without surprises.

## 1. Goals & non-goals

**Goals**
- Single sign-on across `xcity.one` (root account portal), `chat.xcity.one`
  (Xcity-Chat), and any subdomain hosting `xct-new-api` (e.g.
  `api.xcity.one` / `xct.xcity.one`).
- Account information (credit balance, top-ups, billing, profile editing)
  lives **only** on `xcity.one/dashboard`. The other apps surface a link, not
  a copy of the data.
- New user signup happens on `auth.xcity.one`. The other apps must not show
  their own signup form.

**Non-goals**
- Token issuance for the upstream LLM API (those are still managed inside
  `xct-new-api` per the existing model). SSO covers user-portal login only.
- Replacing existing OAuth providers (GitHub, Discord, etc.). Those remain
  available unless `xcity.sso_enabled` is true, in which case the UI hides
  them in favor of the single XCity entry point.

## 2. Identity provider: auth.xcity.one (OIDC)

`auth.xcity.one` is consumed as a standard OIDC provider. Each downstream
app registers as an OIDC client and is configured with:

| Field | Value |
|---|---|
| Issuer / discovery | `https://auth.xcity.one/.well-known/openid-configuration` |
| Authorization endpoint | from discovery |
| Token endpoint | from discovery |
| Userinfo endpoint | from discovery |
| Scopes | `openid profile email` |
| Response type | `code` (authorization code flow) |

Userinfo response MUST contain the following claims (see
[`oauth/oidc.go`](../oauth/oidc.go) for the binding):

```json
{
  "sub": "stable-xcity-user-id",
  "email": "user@example.com",
  "name": "Display Name",
  "preferred_username": "user-handle",
  "picture": "https://..."
}
```

`sub` is the stable identifier. `xct-new-api` stores it in the
`users.oidc_id` column; collisions across apps are not possible because all
apps trust the same issuer.

## 3. Redirect URIs

Each app owns its own OAuth callback path. The XCity OIDC client MUST
allow-list each one explicitly:

| App | Callback URI |
|---|---|
| xct-new-api | `https://<api-host>/oauth/oidc` |
| Xcity-Chat | `https://chat.xcity.one/oauth/callback` (or wherever the chat app's OIDC handler lives) |
| xcity.one (account portal) | N/A — the IdP itself lives here |

The redirect URI for `xct-new-api` is constructed in
[`oauth/oidc.go`](../oauth/oidc.go) as `${ServerAddress}/oauth/oidc`. Set
`ServerAddress` to the public-facing host of the deployment.

## 4. Session strategy & cookie domain

`xct-new-api` uses Gin cookie-backed sessions ([`main.go`](../main.go)).
Three knobs (env vars) gate cross-subdomain behavior; defaults preserve the
single-domain status quo:

| Env var | Default | XCity SSO recommendation |
|---|---|---|
| `SESSION_COOKIE_DOMAIN` | `""` (host-only cookie) | `.xcity.one` |
| `SESSION_COOKIE_SECURE` | `false` | `true` (production HTTPS) |
| `SESSION_COOKIE_SAMESITE` | `strict` | `lax` |

`SameSite=Lax` is required because the OAuth callback is a cross-site
top-level GET; `Strict` cookies are not sent on it. `Secure` is required by
modern browsers whenever `SameSite=None`, and is best-practice for `Lax`
over HTTPS.

Xcity-Chat MUST use the same cookie name namespace strategy — i.e. each
app sets its own cookie under the `.xcity.one` parent so they coexist
without colliding. Apps do **not** read each other's cookies; SSO is
achieved by going through the IdP, not by sharing session state directly.

## 5. Signup flow

When `xcity.sso_enabled` is true:

1. User hits `/sign-up` on `xct-new-api`.
2. Frontend immediately redirects to `xcity.signup_url` (default
   `https://auth.xcity.one`). See
   [`web/default/src/features/auth/sign-up/index.tsx`](../web/default/src/features/auth/sign-up/index.tsx).
3. User completes signup on `auth.xcity.one`.
4. User returns to the originating app and signs in via the OIDC button.
   First sign-in auto-creates the `users` row keyed by `sub`.

Xcity-Chat MUST follow the same pattern: never render a local signup form
when SSO mode is on.

## 6. Login flow

1. App's `/sign-in` page renders a single primary button "Sign in with
   XCity" (see
   [`oauth-providers.tsx`](../web/default/src/features/auth/components/oauth-providers.tsx)).
2. Click → `GET /api/oauth/state` → push the user to
   `auth.xcity.one/authorize?client_id=&redirect_uri=&response_type=code&state=&scope=openid+profile+email`.
3. IdP redirects back to the app's callback with `?code=&state=`.
4. App exchanges code → fetches userinfo → upserts user → sets session
   cookie scoped to `.xcity.one`.
5. App redirects to its own `/dashboard` (or the `redirect=` query param
   captured before login).

## 7. Surfaces hidden in SSO mode (xct-new-api side)

When `xcity.sso_enabled` is true the frontend deliberately suppresses these
surfaces because the source of truth is `xcity.one/dashboard`:

- `/sign-in`: email/password form, passkey button, all non-XCity OAuth
  providers.
- `/sign-up`: redirected to `xcity.signup_url`.
- `ProfileDropdown`: "Wallet" entry replaced with "Manage account on XCity".
- Top-nav: "Model Square" / Pricing entry hidden.
- `/dashboard` overview: quota / used quota / request count cards replaced
  with a single "Open XCity dashboard" banner.
- `/wallet` and `/pricing/` page bodies: replaced with the
  `XcityRedirectPage` stub linking to `xcity.dashboardUrl`. (The routes
  themselves are still mounted; only the rendered content changes.)

## 8. Server config

In `setting/system_setting/xcity.go`:

```go
type XCitySettings struct {
    Enabled       bool   // master flag
    ProviderLabel string // text on the SSO button, default "XCity"
    DashboardURL  string // off-app account dashboard
    SignupURL     string // /sign-up redirect target
}
```

Stored under the `xcity.*` option prefix. Mirrored into `/api/status` as
`xcity_sso_enabled`, `xcity_provider_label`, `xcity_dashboard_url`,
`xcity_signup_url` so the SPA can react without a code change.

Operators turn the integration on by:

1. Configuring the OIDC client in System Settings → Auth → OIDC, pointing
   at `auth.xcity.one`.
2. Setting `xcity.enabled = true` (and customizing URLs if needed).
3. Setting the three `SESSION_COOKIE_*` env vars on the deployment.

## 9. Xcity-Chat's side of the contract

For symmetry, Xcity-Chat is expected to:

- Register its own OIDC client at `auth.xcity.one` with redirect URI
  `https://chat.xcity.one/oauth/callback`.
- Issue session cookies on `.xcity.one` (Domain=`.xcity.one`, SameSite=Lax,
  Secure=true) so the post-login user state is visible to the chat origin.
- Hide all local credential UI; render only "Sign in with XCity".
- Surface a "Manage account on XCity" link in its profile menu pointing at
  `xcity.dashboardUrl`. It MUST NOT render its own credit/billing UI.
- Forward `redirect=` query params during login the same way `xct-new-api`
  does, so deep-link workflows survive the IdP roundtrip.

A future revision of this document should add: token rotation policy,
logout propagation (RP-initiated logout via `end_session_endpoint`), and
how account deletion on `xcity.one` cascades to the downstream apps.

## 10. Tests

Two test suites cover the XCity SSO integration on `xct-new-api`:

### 10.1 Go (backend)

Run from the repo root:

```sh
go test ./common/ ./setting/system_setting/ ./controller/ \
  -run 'TestParseSessionSameSite|TestXCity|TestGetStatusEmitsXCity|TestGetStatusXCityFieldsCoexist' \
  -count=1
```

| File | What it locks down |
|---|---|
| `common/session_cookie_test.go` | `ParseSessionSameSite` resolves `lax` / `none` / `default` / `strict` (case- and whitespace-insensitive); empty/unknown values fall back to `Strict`. |
| `setting/system_setting/xcity_test.go` | `XCitySettings` defaults are off-by-default with XCity URLs pre-filled; the snake_case JSON shape is the public `/api/status` contract; the singleton is registered under the `xcity.*` config prefix; the `LoadFromDB` round-trip hydrates all four fields. |
| `controller/misc_xcity_test.go` | `/api/status` emits `xcity_sso_enabled` / `xcity_provider_label` / `xcity_dashboard_url` / `xcity_signup_url` for both disabled and enabled deployments; XCity fields coexist with the OIDC fields so the SPA can drive the OIDC flow under the XCity button. |

### 10.2 Frontend (React)

Vitest is wired up under `web/default/`. Run from that directory:

```sh
bun install         # one-off, installs vitest + jsdom + @testing-library
bun run test        # single-shot, used in CI
bun run test:watch  # interactive, while editing
bun run test:coverage
```

Key files (`*.test.ts(x)` co-located with source):

| File | What it locks down |
|---|---|
| `src/features/auth/hooks/use-xcity-sso.test.ts` | Defaults when `/api/status` is empty; reads top-level fields; falls back to `data.*`; top-level wins on conflict; only literal `true` enables SSO mode; empty/whitespace strings fall back to defaults. |
| `src/features/auth/components/oauth-providers.test.tsx` | SSO mode renders one "Sign in with XCity" button wired to the OIDC handler; SSO without OIDC enabled renders nothing; with SSO off, the standard provider list is rendered. |
| `src/features/auth/sign-in/components/user-auth-form.test.tsx` | Username/password fields render in normal mode; in SSO mode they are removed and only OAuth providers + legal consent render. |
| `src/features/auth/sign-up/index.test.tsx` | Local form renders in normal mode; SSO mode triggers `window.location.replace(signupUrl)` exactly once; rerender does not re-fire the redirect. |
| `src/components/profile-dropdown.test.tsx` | Wallet link renders in normal mode; SSO mode replaces it with a `target="_blank"` link to `xcity.dashboardUrl`. |
| `src/features/dashboard/components/overview/summary-cards.test.tsx` | Three numeric stat cards in normal mode; SSO mode swaps them for the off-app banner with a link to `xcity.dashboardUrl`. |
| `src/components/xcity-redirect-page.test.tsx` | Default reason text + dashboard link wiring; custom `reason` prop overrides default text. |
| `src/hooks/use-top-nav-links.test.ts` | Pricing link present in normal mode; absent in SSO mode; backend `pricing.enabled=false` still wins independently of SSO. |

Vitest configuration lives in `web/default/vitest.config.ts`; the shared
setup at `src/test/setup.ts` mocks `react-i18next` so `t('foo {{name}}', {
name: 'XCity' })` interpolates predictably without bootstrapping i18n.

### 10.3 Manual verification (not yet automated)

These paths exercise integration surfaces that don't have an automated
test today — run them in a staging environment before each release:

- **Real OIDC roundtrip** against `auth.xcity.one`: code → token → userinfo
  → user upsert → session cookie set on `.xcity.one`.
- **Cross-subdomain cookie**: log in on `xct.xcity.one`, navigate to
  `chat.xcity.one`, confirm the chat app sees the same session (assuming
  Xcity-Chat shares the OIDC client and reads `.xcity.one` cookies).
- **Logout propagation**: signing out on one subdomain — does the user
  remain logged in on the other? (Currently expected to: documented as a
  future revision in §9.)
- **`SESSION_COOKIE_SAMESITE=lax` + `Secure=true`** in production: the
  OAuth callback (cross-site top-level GET) succeeds with the cookie
  attached.
- **`/sign-up` redirect**: a real browser receives the redirect and lands
  on `auth.xcity.one`; users without JS see the fallback link.
- **Translation coverage**: the new keys (e.g. `Sign in with {{name}}`,
  `Manage account on {{name}}`, `Open {{name}} dashboard`,
  `Account balance and usage live on {{name}}`, `Managed on {{name}}`,
  `Redirecting to {{name}}…`) need to be added to
  `web/default/src/i18n/locales/{en,zh,fr,ru,ja,vi}.json` via
  `bun run i18n:sync`.
