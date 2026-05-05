package system_setting

import "github.com/QuantumNous/new-api/setting/config"

// XCitySettings controls the XCity SSO integration mode.
//
// When Enabled is true, the frontend treats auth.xcity.one as the sole
// authentication entry point and hides surfaces (wallet, pricing, quota
// statistics) whose source-of-truth lives on xcity.one/dashboard.
//
// The actual OAuth flow still runs through the existing OIDC provider
// (see oauth/oidc.go) — XCitySettings is purely UI/UX surface control,
// plus configurable destination URLs for the off-app jumps.
type XCitySettings struct {
	Enabled       bool   `json:"enabled"`
	ProviderLabel string `json:"provider_label"`
	DashboardURL  string `json:"dashboard_url"`
	SignupURL     string `json:"signup_url"`
}

var defaultXCitySettings = XCitySettings{
	Enabled:       false,
	ProviderLabel: "XCity",
	DashboardURL:  "https://xcity.one/dashboard",
	SignupURL:     "https://auth.xcity.one",
}

func init() {
	config.GlobalConfig.Register("xcity", &defaultXCitySettings)
}

func GetXCitySettings() *XCitySettings {
	return &defaultXCitySettings
}
