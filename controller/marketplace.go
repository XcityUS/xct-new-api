package controller

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
)

var tokenhubHTTPClient = &http.Client{Timeout: 15 * time.Second}

func tokenhubBaseURL() string {
	return strings.TrimSuffix(os.Getenv("TOKENHUB_BASE_URL"), "/")
}

func tokenhubAPIKey() string {
	return os.Getenv("TOKENHUB_API_KEY")
}

func proxyTokenhubGet(c *gin.Context, path string) {
	base := tokenhubBaseURL()
	if base == "" {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"success": false,
			"message": "Tokenhub integration not configured (TOKENHUB_BASE_URL not set)",
		})
		return
	}

	targetURL := base + path
	if c.Request.URL.RawQuery != "" {
		targetURL += "?" + c.Request.URL.RawQuery
	}

	req, err := http.NewRequestWithContext(c.Request.Context(), http.MethodGet, targetURL, nil)
	if err != nil {
		common.SysLog(fmt.Sprintf("marketplace: failed to build request to %s: %v", targetURL, err))
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "internal error"})
		return
	}

	apiKey := tokenhubAPIKey()
	if apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+apiKey)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := tokenhubHTTPClient.Do(req)
	if err != nil {
		common.SysLog(fmt.Sprintf("marketplace: request to tokenhub failed: %v", err))
		c.JSON(http.StatusBadGateway, gin.H{"success": false, "message": "failed to reach Tokenhub"})
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		common.SysLog(fmt.Sprintf("marketplace: failed to read tokenhub response: %v", err))
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "internal error"})
		return
	}

	contentType := resp.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/json"
	}
	c.Data(resp.StatusCode, contentType, body)
}

// GetMarketplaceAgents proxies /api/marketplace/agents → Tokenhub /v1/agents
func GetMarketplaceAgents(c *gin.Context) {
	proxyTokenhubGet(c, "/v1/agents")
}

// GetMarketplaceAgent proxies /api/marketplace/agents/:id → Tokenhub /v1/agents/:id
func GetMarketplaceAgent(c *gin.Context) {
	id := c.Param("id")
	proxyTokenhubGet(c, "/v1/agents/"+id)
}

// GetMarketplaceSkills proxies /api/marketplace/skills → Tokenhub /v1/xct-skills
func GetMarketplaceSkills(c *gin.Context) {
	proxyTokenhubGet(c, "/v1/xct-skills")
}
