package system_setting

import "github.com/QuantumNous/new-api/setting/config"

// CloudflareX402Settings controls the Cloudflare x402 monetization gateway (L-016).
//
// These settings are surfaced in the admin dashboard and mirrored in the
// CF Worker via wrangler.toml vars. The dashboard page reads from this
// struct; updates propagate to the Worker on next wrangler deploy.
type CloudflareX402Settings struct {
	// Enabled is the global x402 feature toggle.
	Enabled bool `json:"enabled"`

	// FacilitatorURL is the primary x402 facilitator endpoint.
	// Default: Coinbase CDP (https://api.cdp.coinbase.com/platform/x402)
	FacilitatorURL string `json:"facilitator_url"`

	// X401FallbackURL is the legacy X401 facilitator endpoint used for the
	// 30% fallback slice of traffic.
	X401FallbackURL string `json:"x401_fallback_url"`

	// RoutePercent is the fraction of traffic (0–100) routed to the x402
	// facilitator; the remainder goes to X401.
	RoutePercent int `json:"route_percent"`

	// ReceiverAddress is the USDC recipient address on Base mainnet.
	ReceiverAddress string `json:"receiver_address"`

	// PriceUSDC is the per-request price in USDC atomic units (6 decimals).
	// 10000 = $0.01.
	PriceUSDC int `json:"price_usdc"`

	// Network is the CAIP-2 chain identifier (e.g. "eip155:8453" for Base).
	Network string `json:"network"`

	// Projects is the per-project x402 opt-in map: projectName → enabled.
	// Populated from wrangler.toml per-env X402_ENABLED vars.
	Projects map[string]bool `json:"projects"`
}

var defaultCloudflareX402Settings = CloudflareX402Settings{
	Enabled:         false,
	FacilitatorURL:  "https://api.cdp.coinbase.com/platform/x402",
	X401FallbackURL: "https://x401.xcity.one",
	RoutePercent:    70,
	ReceiverAddress: "",
	PriceUSDC:       10000,
	Network:         "eip155:8453",
	Projects: map[string]bool{
		"xcity-home":  false,
		"xcity-chat":  false,
		"xcity-api":   true,
		"xcity-admin": false,
	},
}

func init() {
	config.GlobalConfig.Register("cloudflare_x402", &defaultCloudflareX402Settings)
}

func GetCloudflareX402Settings() *CloudflareX402Settings {
	return &defaultCloudflareX402Settings
}
