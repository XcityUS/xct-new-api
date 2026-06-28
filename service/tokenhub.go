package service

import (
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/system_setting"
)

type TokenHubAgent struct {
	ID          string           `json:"id"`
	Slug        string           `json:"slug"`
	DisplayName string           `json:"display_name"`
	Name        string           `json:"name"`
	Description string           `json:"description"`
	Category    string           `json:"category"`
	Tags        []string         `json:"tags"`
	Skills      []TokenHubSkill  `json:"skills"`
	Version     *string          `json:"version"`
	Streaming   bool             `json:"streaming"`
	IsPublic    bool             `json:"is_public"`
	CreatedAt   string           `json:"created_at"`
	UpdatedAt   string           `json:"updated_at"`
}

type TokenHubSkill struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Version     *string  `json:"version"`
	Tags        []string `json:"tags"`
}

type tokenHubCache struct {
	mu         sync.RWMutex
	agents     []TokenHubAgent
	skills     []TokenHubSkill
	agentsTTL  time.Time
	skillsTTL  time.Time
}

var thCache = &tokenHubCache{}

const cacheTTL = 60 * time.Second

func TokenHubListAgents() ([]TokenHubAgent, error) {
	thCache.mu.RLock()
	if time.Now().Before(thCache.agentsTTL) {
		agents := thCache.agents
		thCache.mu.RUnlock()
		return agents, nil
	}
	thCache.mu.RUnlock()

	settings := system_setting.GetTokenHubSettings()
	if !settings.Enabled || settings.BaseURL == "" {
		return nil, nil
	}

	url := settings.BaseURL + "/v1/agents?is_public=true"
	data, err := tokenHubGet(url, settings.APIKey)
	if err != nil {
		return nil, fmt.Errorf("tokenhub list agents: %w", err)
	}

	var agents []TokenHubAgent
	if err := common.Unmarshal(data, &agents); err != nil {
		return nil, fmt.Errorf("tokenhub parse agents: %w", err)
	}

	thCache.mu.Lock()
	thCache.agents = agents
	thCache.agentsTTL = time.Now().Add(cacheTTL)
	thCache.mu.Unlock()

	return agents, nil
}

func TokenHubListSkills() ([]TokenHubSkill, error) {
	thCache.mu.RLock()
	if time.Now().Before(thCache.skillsTTL) {
		skills := thCache.skills
		thCache.mu.RUnlock()
		return skills, nil
	}
	thCache.mu.RUnlock()

	settings := system_setting.GetTokenHubSettings()
	if !settings.Enabled || settings.BaseURL == "" {
		return nil, nil
	}

	url := settings.BaseURL + "/v1/xct-skills"
	data, err := tokenHubGet(url, settings.APIKey)
	if err != nil {
		return nil, fmt.Errorf("tokenhub list skills: %w", err)
	}

	var skills []TokenHubSkill
	if err := common.Unmarshal(data, &skills); err != nil {
		return nil, fmt.Errorf("tokenhub parse skills: %w", err)
	}

	thCache.mu.Lock()
	thCache.skills = skills
	thCache.skillsTTL = time.Now().Add(cacheTTL)
	thCache.mu.Unlock()

	return skills, nil
}

func TokenHubGetAgent(agentID string) (*TokenHubAgent, error) {
	settings := system_setting.GetTokenHubSettings()
	if !settings.Enabled || settings.BaseURL == "" {
		return nil, fmt.Errorf("tokenhub not enabled")
	}

	url := settings.BaseURL + "/v1/agents/" + agentID
	data, err := tokenHubGet(url, settings.APIKey)
	if err != nil {
		return nil, fmt.Errorf("tokenhub get agent: %w", err)
	}

	var agent TokenHubAgent
	if err := common.Unmarshal(data, &agent); err != nil {
		return nil, fmt.Errorf("tokenhub parse agent: %w", err)
	}

	return &agent, nil
}

func tokenHubGet(url string, apiKey string) ([]byte, error) {
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	if apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+apiKey)
	}
	req.Header.Set("Accept", "application/json")

	client := GetHttpClient()
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer CloseResponseBodyGracefully(resp)

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("status %d: %s", resp.StatusCode, string(body))
	}

	return io.ReadAll(resp.Body)
}
