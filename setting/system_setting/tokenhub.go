package system_setting

import "github.com/QuantumNous/new-api/setting/config"

type TokenHubSettings struct {
	Enabled bool   `json:"enabled"`
	BaseURL string `json:"base_url"`
	APIKey  string `json:"api_key"`
}

var defaultTokenHubSettings = TokenHubSettings{
	Enabled: false,
	BaseURL: "https://tokenhub.xcity.one",
	APIKey:  "",
}

func init() {
	config.GlobalConfig.Register("tokenhub", &defaultTokenHubSettings)
}

func GetTokenHubSettings() *TokenHubSettings {
	return &defaultTokenHubSettings
}
