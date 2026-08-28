# L-016 CF Worker x402 Gateway — Rollback Plan (Sub-task 6)

**Target**: 30-second rollback to previous CF Worker version on any sub-task failure.

## How CF Worker Versioned Deployments Work

Every `wrangler deploy` creates an immutable deployment snapshot with a unique
deployment ID. Cloudflare retains the previous 10 deployments per Worker.
`wrangler rollback` activates the previous deployment without a new deploy,
taking effect globally within ~15 seconds.

## Rollback Procedure

### Step 1 — Identify the deployment to roll back to

```bash
# List all deployments with their IDs and timestamps
wrangler deployments list --name xcity-x402-gateway --env production
```

Example output:
```
Deployment ID                          Status    Created At
f3a9b2c1-...                           Active    2026-07-03 10:05:00
d7e1f4a8-...                           Inactive  2026-07-03 09:50:00  ← rollback target
```

### Step 2 — Roll back (< 30 seconds total)

**Option A: Roll back to immediately previous deployment (most common)**

```bash
wrangler rollback --env production
```

**Option B: Roll back to a specific deployment ID**

```bash
wrangler rollback f3a9b2c1-0000-0000-0000-000000000000 --env production
```

Both commands take effect globally within ~15 seconds.

### Step 3 — Verify rollback

```bash
# Check current active deployment
wrangler deployments list --name xcity-x402-gateway --env production

# Smoke test: confirm /health returns 200 and 402 is not returned
curl -I https://api.xcity.one/health
curl -I https://api.xcity.one/v1/chat/completions
```

### Step 4 — Disable x402 without rollback (emergency kill-switch)

If rollback is not feasible, disable x402 entirely by setting the env var:

```bash
wrangler secret put X402_ENABLED --env production
# Enter: false
```

This takes effect on the next request (no redeploy needed for secrets).

## Sub-task Failure → Rollback Mapping

| Sub-task | Failure Indicator | Rollback Action |
|----------|------------------|-----------------|
| 1. Per-project flag | `X402_ENABLED=true` breaks project | `wrangler secret put X402_ENABLED` → `"false"` for that env |
| 2. Middleware | 5xx spike in CF dashboard | `wrangler rollback --env production` |
| 3. Facilitator routing | Payment verify failures > 10% | `wrangler rollback` OR set `X402_ROUTE_PERCENT=0` |
| 4. Dashboard API | xct-new-api 5xx | Redeploy xct-new-api from previous git SHA |
| 5. e2e tests | Any scenario fails | Block deploy, do not roll forward |
| 6. This plan | — | — |

## Automated Rollback (CI/CD Integration)

Add to GitHub Actions deploy workflow after `wrangler deploy`:

```yaml
- name: Smoke test x402 gateway
  run: |
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://api.xcity.one/health)
    if [ "$STATUS" != "200" ]; then
      echo "Health check failed ($STATUS), rolling back..."
      npx wrangler rollback --env production
      exit 1
    fi
```

## Deployment History Retention

Cloudflare retains the last 10 deployments. Do NOT exceed 10 deployments between
verifications to ensure a rollback target is always available.
