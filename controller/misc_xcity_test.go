package controller

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

// invokeGetStatus runs the GetStatus handler in-memory and returns the
// decoded `data` payload. It exists so tests can assert individual /api/status
// fields without spinning up the full HTTP server.
func invokeGetStatus(t *testing.T) map[string]any {
	t.Helper()

	gin.SetMode(gin.TestMode)
	// GetStatus reads from common.OptionMap; init it so the RWMutex inside
	// is at least valid. The map content is irrelevant for our assertions.
	if common.OptionMap == nil {
		common.OptionMap = map[string]string{}
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/status", nil)

	GetStatus(c)

	require.Equal(t, http.StatusOK, w.Code, "status handler should respond 200, body=%s", w.Body.String())

	var envelope struct {
		Success bool           `json:"success"`
		Message string         `json:"message"`
		Data    map[string]any `json:"data"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &envelope))
	require.True(t, envelope.Success, "expected success=true, message=%q", envelope.Message)
	return envelope.Data
}

// TestGetStatusEmitsXCitySSODisabled covers the default deployment: the four
// xcity_* fields are present and signal "off" so the SPA renders the standard
// auth UI.
func TestGetStatusEmitsXCitySSODisabled(t *testing.T) {
	xcity := system_setting.GetXCitySettings()
	original := *xcity
	t.Cleanup(func() { *xcity = original })

	*xcity = system_setting.XCitySettings{
		Enabled:       false,
		ProviderLabel: "XCity",
		DashboardURL:  "https://xcity.one/dashboard",
		SignupURL:     "https://auth.xcity.one",
	}

	data := invokeGetStatus(t)
	require.Contains(t, data, "xcity_sso_enabled")
	require.Equal(t, false, data["xcity_sso_enabled"])
	require.Equal(t, "XCity", data["xcity_provider_label"])
	require.Equal(t, "https://xcity.one/dashboard", data["xcity_dashboard_url"])
	require.Equal(t, "https://auth.xcity.one", data["xcity_signup_url"])
}

// TestGetStatusEmitsXCitySSOEnabled covers the "SSO mode is on" deployment.
// This is the input the frontend useXCitySSO hook keys off of.
func TestGetStatusEmitsXCitySSOEnabled(t *testing.T) {
	xcity := system_setting.GetXCitySettings()
	original := *xcity
	t.Cleanup(func() { *xcity = original })

	*xcity = system_setting.XCitySettings{
		Enabled:       true,
		ProviderLabel: "Acme SSO",
		DashboardURL:  "https://acme.test/dashboard",
		SignupURL:     "https://acme.test/signup",
	}

	data := invokeGetStatus(t)
	require.Equal(t, true, data["xcity_sso_enabled"])
	require.Equal(t, "Acme SSO", data["xcity_provider_label"])
	require.Equal(t, "https://acme.test/dashboard", data["xcity_dashboard_url"])
	require.Equal(t, "https://acme.test/signup", data["xcity_signup_url"])
}

// TestGetStatusXCityFieldsCoexistWithOIDC asserts that XCity SSO mode does
// not crowd out the OIDC fields — both must be present so the SPA can drive
// the OIDC flow under the XCity button.
func TestGetStatusXCityFieldsCoexistWithOIDC(t *testing.T) {
	xcity := system_setting.GetXCitySettings()
	originalXCity := *xcity
	oidc := system_setting.GetOIDCSettings()
	originalOIDC := *oidc
	t.Cleanup(func() {
		*xcity = originalXCity
		*oidc = originalOIDC
	})

	*xcity = system_setting.XCitySettings{
		Enabled:       true,
		ProviderLabel: "XCity",
		DashboardURL:  "https://xcity.one/dashboard",
		SignupURL:     "https://auth.xcity.one",
	}
	*oidc = system_setting.OIDCSettings{
		Enabled:               true,
		ClientId:              "client-abc",
		AuthorizationEndpoint: "https://auth.xcity.one/authorize",
	}

	data := invokeGetStatus(t)
	require.Equal(t, true, data["xcity_sso_enabled"])
	require.Equal(t, true, data["oidc_enabled"])
	require.Equal(t, "client-abc", data["oidc_client_id"])
	require.Equal(t, "https://auth.xcity.one/authorize", data["oidc_authorization_endpoint"])
}
