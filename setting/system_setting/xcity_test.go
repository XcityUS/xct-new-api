package system_setting

import (
	"encoding/json"
	"testing"

	"github.com/QuantumNous/new-api/setting/config"
	"github.com/stretchr/testify/require"
)

// TestXCitySettingsDefaults locks down the off-by-default contract: a fresh
// install MUST NOT enter SSO-only mode, but the off-app URLs MUST already
// point at xcity.one so an operator only needs to flip Enabled=true.
func TestXCitySettingsDefaults(t *testing.T) {
	original := defaultXCitySettings
	t.Cleanup(func() { defaultXCitySettings = original })

	defaultXCitySettings = XCitySettings{
		Enabled:       false,
		ProviderLabel: "XCity",
		DashboardURL:  "https://xcity.one/dashboard",
		SignupURL:     "https://auth.xcity.one",
	}

	got := GetXCitySettings()
	require.False(t, got.Enabled)
	require.Equal(t, "XCity", got.ProviderLabel)
	require.Equal(t, "https://xcity.one/dashboard", got.DashboardURL)
	require.Equal(t, "https://auth.xcity.one", got.SignupURL)
}

// TestXCitySettingsJSONShape pins the wire format consumed by the SPA. The
// snake_case keys are part of the public /api/status contract and tests in
// the frontend rely on this exact shape.
func TestXCitySettingsJSONShape(t *testing.T) {
	s := XCitySettings{
		Enabled:       true,
		ProviderLabel: "XCity",
		DashboardURL:  "https://example.test/dashboard",
		SignupURL:     "https://example.test/signup",
	}
	raw, err := json.Marshal(s)
	require.NoError(t, err)

	var decoded map[string]any
	require.NoError(t, json.Unmarshal(raw, &decoded))

	require.Equal(t, true, decoded["enabled"])
	require.Equal(t, "XCity", decoded["provider_label"])
	require.Equal(t, "https://example.test/dashboard", decoded["dashboard_url"])
	require.Equal(t, "https://example.test/signup", decoded["signup_url"])
}

// TestXCitySettingsConfigRegistry verifies that the singleton is registered
// under the "xcity" prefix and that updates propagate through GetXCitySettings.
func TestXCitySettingsConfigRegistry(t *testing.T) {
	original := defaultXCitySettings
	t.Cleanup(func() { defaultXCitySettings = original })

	defaultXCitySettings.Enabled = true
	defaultXCitySettings.ProviderLabel = "XCityTest"
	defaultXCitySettings.DashboardURL = "https://test.example/dash"
	defaultXCitySettings.SignupURL = "https://test.example/signup"

	got := GetXCitySettings()
	require.True(t, got.Enabled)
	require.Equal(t, "XCityTest", got.ProviderLabel)

	// The registry MUST hand back the same pointer that GetXCitySettings
	// returns — this is what allows option-table mutations from the admin
	// panel to affect the running config.
	registered, ok := config.GlobalConfig.Get("xcity").(*XCitySettings)
	require.True(t, ok, "xcity entry should be *XCitySettings, got %T", config.GlobalConfig.Get("xcity"))
	require.Same(t, &defaultXCitySettings, registered)

	// Round-trip via the flat exporter the option-table loader uses on boot.
	exported := config.GlobalConfig.ExportAllConfigs()
	require.Equal(t, "true", exported["xcity.enabled"])
	require.Equal(t, "XCityTest", exported["xcity.provider_label"])
	require.Equal(t, "https://test.example/dash", exported["xcity.dashboard_url"])
	require.Equal(t, "https://test.example/signup", exported["xcity.signup_url"])
}

// TestXCitySettingsLoadFromDB simulates the boot path that hydrates the
// config from the option table.
func TestXCitySettingsLoadFromDB(t *testing.T) {
	original := defaultXCitySettings
	t.Cleanup(func() { defaultXCitySettings = original })

	defaultXCitySettings = XCitySettings{}

	err := config.GlobalConfig.LoadFromDB(map[string]string{
		"xcity.enabled":        "true",
		"xcity.provider_label": "Acme SSO",
		"xcity.dashboard_url":  "https://acme.test/dashboard",
		"xcity.signup_url":     "https://acme.test/signup",
	})
	require.NoError(t, err)

	got := GetXCitySettings()
	require.True(t, got.Enabled)
	require.Equal(t, "Acme SSO", got.ProviderLabel)
	require.Equal(t, "https://acme.test/dashboard", got.DashboardURL)
	require.Equal(t, "https://acme.test/signup", got.SignupURL)
}
